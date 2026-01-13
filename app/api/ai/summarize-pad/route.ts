import { generateText, isAIAvailable } from "@/lib/ai/ai-provider"
import { createDatabaseClient } from "@/lib/database/database-adapter"
import { NextResponse } from "next/server"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

export const maxDuration = 30

export async function POST(req: Request) {
  try {
    if (!isAIAvailable()) {
      return NextResponse.json({ error: "AI service not configured" }, { status: 500 })
    }

    const db = await createDatabaseClient()
    const authResult = await getCachedAuthUser()

    if (authResult.rateLimited) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again in a moment." },
        { status: 429, headers: { "Retry-After": "30" } },
      )
    }

    if (!authResult.user) {
      return new NextResponse("Unauthorized", { status: 401 })
    }

    const user = authResult.user

    const orgContext = await getOrgContext()
    if (!orgContext) {
      return new NextResponse("No organization context", { status: 403 })
    }

    const { padId } = await req.json()

    if (!padId) {
      return new NextResponse("Pad ID is required", { status: 400 })
    }

    const { data: pad } = await db
      .from("paks_pads")
      .select("*")
      .eq("id", padId)
      .eq("org_id", orgContext.orgId)
      .maybeSingle()

    const { data: sticks } = await db
      .from("paks_pad_sticks")
      .select("*")
      .eq("pad_id", padId)
      .eq("org_id", orgContext.orgId)

    if (!pad) {
      return new NextResponse("Pad not found", { status: 404 })
    }

    // Fetch calstick counts separately for each stick
    const stickIds = (sticks || []).map((s: any) => s.id)
    let calstickCounts: Record<string, number> = {}
    if (stickIds.length > 0) {
      const { data: calsticks } = await db
        .from("paks_pad_stick_replies")
        .select("stick_id")
        .in("stick_id", stickIds)
        .eq("is_calstick", true)

      if (calsticks) {
        calsticks.forEach((c: any) => {
          calstickCounts[c.stick_id] = (calstickCounts[c.stick_id] || 0) + 1
        })
      }
    }

    const sticksContext = sticks
      ?.map(
        (stick: any) => `
      Topic: ${stick.topic || "Untitled"}
      Content: ${stick.content}
      Tasks: ${calstickCounts[stick.id] || 0}
    `,
      )
      .join("\n")

    const { text } = await generateText({
      prompt: `Summarize the progress and content of this project pad named "${pad.name}".
      
      Pad Description: ${pad.description || "None"}
      
      Sticks (Tasks/Notes):
      ${sticksContext}
      
      Provide a concise executive summary focusing on key themes, workload, and overall status. Use markdown formatting.`,
    })

    return NextResponse.json({ summary: text })
  } catch (error) {
    console.error("[AI Summarize Pad] Error:", error)
    return new NextResponse("Internal Error", { status: 500 })
  }
}

import { generateText } from "ai"
import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { xai } from "@ai-sdk/xai"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

export const maxDuration = 30

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const authResult = await getCachedAuthUser(supabase)

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

    const orgContext = await getOrgContext(user.id)
    if (!orgContext) {
      return new NextResponse("No organization context", { status: 403 })
    }

    const { padId } = await req.json()

    if (!padId) {
      return new NextResponse("Pad ID is required", { status: 400 })
    }

    const { data: pad } = await supabase
      .from("paks_pads")
      .select("*")
      .eq("id", padId)
      .eq("org_id", orgContext.orgId)
      .maybeSingle()

    const { data: sticks } = await supabase
      .from("paks_pad_sticks")
      .select(`
        *,
        calsticks:paks_pad_stick_replies(
          count,
          calstick_status,
          calstick_completed
        )
      `)
      .eq("pad_id", padId)
      .eq("org_id", orgContext.orgId)

    if (!pad) {
      return new NextResponse("Pad not found", { status: 404 })
    }

    const sticksContext = sticks
      ?.map(
        (stick) => `
      Topic: ${stick.topic || "Untitled"}
      Content: ${stick.content}
      Tasks: ${stick.calsticks?.[0]?.count || 0}
    `,
      )
      .join("\n")

    const { text } = await generateText({
      model: xai("grok-2-1212"),
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

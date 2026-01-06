import { NextResponse } from "next/server"
import { createDatabaseClient } from "@/lib/database/database-adapter"
import { GrokService } from "@/lib/ai/grok-service"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

export async function POST(request: Request) {
  try {
    const db = await createDatabaseClient()
    const authResult = await getCachedAuthUser()

    if (authResult.rateLimited) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again in a moment." },
        { status: 429, headers: { "Retry-After": "30" } },
      )
    }

    if (!authResult.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const user = authResult.user

    const orgContext = await getOrgContext()
    if (!orgContext) {
      return NextResponse.json({ error: "No organization context" }, { status: 403 })
    }

    const { content, padId } = await request.json()

    if (!content || !padId) {
      return NextResponse.json({ error: "Content and padId are required" }, { status: 400 })
    }

    const { data: existingSticks, error } = await db
      .from("social_sticks")
      .select("id, content, topic")
      .eq("social_pad_id", padId)
      .eq("org_id", orgContext.orgId)
      .limit(20)
      .order("created_at", { ascending: false })

    if (error) {
      return NextResponse.json({ error: "Failed to fetch existing sticks" }, { status: 500 })
    }

    const result = await GrokService.checkDuplicate(content, existingSticks || [])

    return NextResponse.json(result)
  } catch (error) {
    console.error("[check-duplicate] Error:", error)
    return NextResponse.json({ error: "Failed to check duplicate" }, { status: 500 })
  }
}

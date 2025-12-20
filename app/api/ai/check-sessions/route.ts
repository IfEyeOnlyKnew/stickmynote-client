import { NextResponse } from "next/server"
import { createDatabaseClient } from "@/lib/database/database-adapter"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

export const dynamic = "force-dynamic"

export async function GET() {
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

    // Get user's organization
    const { data: member } = await db
      .from("organization_members")
      .select("org_id")
      .eq("user_id", user.id)
      .maybeSingle()

    const orgId = member?.org_id

    // Get max sessions from org settings (default 2)
    let maxSessions = 2
    if (orgId) {
      const { data: org } = await db
        .from("organizations")
        .select("ai_sessions_per_day")
        .eq("id", orgId)
        .maybeSingle()

      if (org?.ai_sessions_per_day) {
        maxSessions = org.ai_sessions_per_day
      }
    }

    // Count sessions used today
    const today = new Date().toISOString().split("T")[0]
    const { data: sessions } = await db
      .from("ai_answer_sessions")
      .select("id")
      .eq("user_id", user.id)
      .eq("session_date", today)

    const usedSessions = sessions?.length || 0
    const remainingSessions = Math.max(0, maxSessions - usedSessions)

    return NextResponse.json({
      max_sessions: maxSessions,
      used_sessions: usedSessions,
      remaining_sessions: remainingSessions,
      can_ask: remainingSessions > 0,
    })
  } catch (error) {
    console.error("Error checking AI sessions:", error)
    return NextResponse.json({ error: "Failed to check sessions" }, { status: 500 })
  }
}

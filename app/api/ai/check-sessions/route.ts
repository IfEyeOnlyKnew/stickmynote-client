import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

export const dynamic = "force-dynamic"

export async function GET() {
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
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const user = authResult.user

    // Get user's organization
    const { data: member } = await supabase
      .from("organization_members")
      .select("org_id")
      .eq("user_id", user.id)
      .maybeSingle()

    const orgId = member?.org_id

    // Get max sessions from org settings (default 2)
    let maxSessions = 2
    if (orgId) {
      const { data: org } = await supabase
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
    const { count } = await supabase
      .from("ai_answer_sessions")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("session_date", today)

    const usedSessions = count || 0
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

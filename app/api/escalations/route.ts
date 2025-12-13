import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

export async function GET(request: Request) {
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

  const { searchParams } = new URL(request.url)
  const status = searchParams.get("status")

  let query = supabase
    .from("notification_escalations")
    .select(`
      *,
      rule:notification_escalation_rules(id, name, trigger_type, escalation_channel)
    `)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50)

  if (status) {
    query = query.eq("status", status)
  }

  const { data: escalations, error } = await query

  if (error) {
    console.error("Error fetching escalations:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ escalations })
}

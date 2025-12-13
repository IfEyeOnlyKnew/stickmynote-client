import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

export async function GET() {
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

  const { data: rules, error } = await supabase
    .from("notification_escalation_rules")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Error fetching escalation rules:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ rules })
}

export async function POST(request: Request) {
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

  try {
    const body = await request.json()

    const { data: rule, error } = await supabase
      .from("notification_escalation_rules")
      .insert({
        user_id: user.id,
        name: body.name,
        description: body.description,
        trigger_type: body.trigger_type,
        trigger_conditions: body.trigger_conditions || {},
        escalation_channel: body.escalation_channel,
        channel_config: body.channel_config || {},
        cooldown_minutes: body.cooldown_minutes || 60,
        max_escalations: body.max_escalations || 3,
        pad_ids: body.pad_ids || [],
        is_active: body.is_active ?? true,
      })
      .select()
      .single()

    if (error) {
      console.error("Error creating escalation rule:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ rule })
  } catch (err) {
    console.error("Error parsing request:", err)
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }
}

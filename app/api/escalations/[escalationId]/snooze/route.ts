import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

export async function POST(request: Request, { params }: { params: Promise<{ escalationId: string }> }) {
  const { escalationId } = await params
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
    const snoozeMinutes = body.minutes || 30

    const snoozedUntil = new Date()
    snoozedUntil.setMinutes(snoozedUntil.getMinutes() + snoozeMinutes)

    const { data: escalation, error } = await supabase
      .from("notification_escalations")
      .update({
        status: "snoozed",
        snoozed_until: snoozedUntil.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", escalationId)
      .eq("user_id", user.id)
      .select()
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!escalation) {
      return NextResponse.json({ error: "Escalation not found" }, { status: 404 })
    }

    return NextResponse.json({ escalation })
  } catch (err) {
    console.error("Error snoozing escalation:", err)
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }
}

import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const dynamic = "force-dynamic"

function getServiceClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export async function POST(request: NextRequest) {
  try {
    const { email, success, ipAddress } = await request.json()

    if (!email) {
      return NextResponse.json({ error: "Email required" }, { status: 400 })
    }

    const supabase = getServiceClient()
    const normalizedEmail = email.toLowerCase().trim()

    // Get organization settings for lockout config
    // First, try to find user's organization
    let maxAttempts = 5
    let lockoutMinutes = 15

    const { data: user } = await supabase.from("users").select("id").eq("email", normalizedEmail).maybeSingle()

    if (user) {
      const { data: membership } = await supabase
        .from("organization_members")
        .select("org_id, organizations(max_failed_attempts, lockout_duration_minutes)")
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle()

      if (membership?.organizations) {
        const org = membership.organizations as { max_failed_attempts?: number; lockout_duration_minutes?: number }
        maxAttempts = org.max_failed_attempts ?? 5
        lockoutMinutes = org.lockout_duration_minutes ?? 15
      }
    }

    if (success) {
      // Clear lockout on successful login
      await supabase.from("account_lockouts").delete().eq("email", normalizedEmail)

      return NextResponse.json({ success: true, cleared: true })
    }

    // Failed attempt - increment counter
    const { data: existing } = await supabase
      .from("account_lockouts")
      .select("*")
      .eq("email", normalizedEmail)
      .maybeSingle()

    const now = new Date()
    let newAttempts = 1
    let lockedUntil: string | null = null

    if (existing) {
      // Check if previous lockout has expired
      if (existing.locked_until && new Date(existing.locked_until) < now) {
        // Reset counter if lockout expired
        newAttempts = 1
      } else {
        newAttempts = (existing.failed_attempts || 0) + 1
      }
    }

    // Lock account if max attempts reached
    if (newAttempts >= maxAttempts) {
      const lockUntilDate = new Date(now.getTime() + lockoutMinutes * 60000)
      lockedUntil = lockUntilDate.toISOString()
    }

    // Upsert the lockout record
    const { error } = await supabase.from("account_lockouts").upsert(
      {
        email: normalizedEmail,
        ip_address: ipAddress || null,
        failed_attempts: newAttempts,
        last_failed_at: now.toISOString(),
        locked_until: lockedUntil,
        updated_at: now.toISOString(),
      },
      {
        onConflict: "email",
      },
    )

    if (error) {
      console.error("Error recording attempt:", error)
      return NextResponse.json({ error: "Failed to record attempt" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      failedAttempts: newAttempts,
      maxAttempts,
      locked: lockedUntil !== null,
      lockedUntil,
      remainingAttempts: Math.max(0, maxAttempts - newAttempts),
    })
  } catch (error) {
    console.error("Error recording attempt:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

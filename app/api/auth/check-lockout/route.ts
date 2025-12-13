import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const dynamic = "force-dynamic"

// Use service role for lockout checks (no auth required)
function getServiceClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json({ error: "Email required" }, { status: 400 })
    }

    const supabase = getServiceClient()
    const normalizedEmail = email.toLowerCase().trim()

    const { data: lockout } = await supabase
      .from("account_lockouts")
      .select("*")
      .eq("email", normalizedEmail)
      .maybeSingle()

    if (lockout && lockout.locked_until) {
      const lockedUntil = new Date(lockout.locked_until)
      const now = new Date()

      if (lockedUntil > now) {
        const remainingMinutes = Math.ceil((lockedUntil.getTime() - now.getTime()) / 60000)
        return NextResponse.json({
          locked: true,
          remainingMinutes,
          failedAttempts: lockout.failed_attempts,
          lockedUntil: lockout.locked_until,
        })
      }
    }

    return NextResponse.json({
      locked: false,
      failedAttempts: lockout?.failed_attempts || 0,
    })
  } catch (error) {
    console.error("Error checking lockout:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

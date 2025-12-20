import { type NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/database/pg-client"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json({ error: "Email required" }, { status: 400 })
    }

    const normalizedEmail = email.toLowerCase().trim()

    const result = await db.query(
      `SELECT * FROM account_lockouts WHERE email = $1`,
      [normalizedEmail]
    )

    const lockout = result.rows[0]

    if (lockout?.locked_until) {
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

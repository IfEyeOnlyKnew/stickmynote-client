// v2 Auth Check Lockout API: production-quality, check account lockout status
import { type NextRequest } from 'next/server'
import { db } from '@/lib/database/pg-client'
import { handleApiError } from '@/lib/api/handle-api-error'

export const dynamic = 'force-dynamic'

// POST /api/v2/auth/check-lockout - Check if account is locked
export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email) {
      return new Response(JSON.stringify({ error: 'Email required' }), { status: 400 })
    }

    const normalizedEmail = email.toLowerCase().trim()

    const result = await db.query(`SELECT * FROM account_lockouts WHERE email = $1`, [normalizedEmail])

    const lockout = result.rows[0]

    if (lockout?.locked_until) {
      const lockedUntil = new Date(lockout.locked_until)
      const now = new Date()

      if (lockedUntil > now) {
        const remainingMinutes = Math.ceil((lockedUntil.getTime() - now.getTime()) / 60000)
        return new Response(
          JSON.stringify({
            locked: true,
            remainingMinutes,
            failedAttempts: lockout.failed_attempts,
            lockedUntil: lockout.locked_until,
          }),
          { status: 200 }
        )
      }
    }

    return new Response(
      JSON.stringify({
        locked: false,
        failedAttempts: lockout?.failed_attempts || 0,
      }),
      { status: 200 }
    )
  } catch (error) {
    return handleApiError(error)
  }
}

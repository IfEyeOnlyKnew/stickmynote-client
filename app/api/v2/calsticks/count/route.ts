// v2 Calsticks Count API: production-quality, get count of incomplete calsticks
import { type NextRequest } from 'next/server'
import { db } from '@/lib/database/pg-client'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'

export const dynamic = 'force-dynamic'

// GET /api/v2/calsticks/count - Get count of incomplete calsticks
export async function GET(_request: NextRequest) {
  try {
    const authResult = await getCachedAuthUser()
    if (!authResult.user) {
      return new Response(JSON.stringify({ count: 0 }), { status: 200 })
    }

    const result = await db.query(
      `SELECT COUNT(*) as count FROM paks_pad_stick_replies
       WHERE is_calstick = true AND calstick_completed = false`
    )

    const count = Number.parseInt(result.rows[0]?.count || '0')

    return new Response(JSON.stringify({ count }), { status: 200 })
  } catch (error) {
    console.error('[CalSticks Count API] Error:', error)
    return new Response(JSON.stringify({ count: 0 }), { status: 200 })
  }
}

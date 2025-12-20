// v2 AI Check Sessions API: production-quality, check remaining AI sessions
import { db } from '@/lib/database/pg-client'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { handleApiError } from '@/lib/api/handle-api-error'

export const dynamic = 'force-dynamic'

// GET /api/v2/ai/check-sessions - Check remaining AI sessions for today
export async function GET() {
  try {
    const authResult = await getCachedAuthUser()

    if (authResult.rateLimited) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }),
        { status: 429, headers: { 'Retry-After': '30' } }
      )
    }

    if (!authResult.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }

    const user = authResult.user

    // Get user's organization
    const memberResult = await db.query(
      `SELECT org_id FROM organization_members WHERE user_id = $1 LIMIT 1`,
      [user.id]
    )
    const orgId = memberResult.rows[0]?.org_id

    // Get max sessions from org settings (default 2)
    let maxSessions = 2
    if (orgId) {
      const orgResult = await db.query(
        `SELECT ai_sessions_per_day FROM organizations WHERE id = $1`,
        [orgId]
      )
      if (orgResult.rows[0]?.ai_sessions_per_day) {
        maxSessions = orgResult.rows[0].ai_sessions_per_day
      }
    }

    // Count sessions used today
    const today = new Date().toISOString().split('T')[0]
    const sessionsResult = await db.query(
      `SELECT id FROM ai_answer_sessions WHERE user_id = $1 AND session_date = $2`,
      [user.id, today]
    )

    const usedSessions = sessionsResult.rows.length
    const remainingSessions = Math.max(0, maxSessions - usedSessions)

    return new Response(
      JSON.stringify({
        max_sessions: maxSessions,
        used_sessions: usedSessions,
        remaining_sessions: remainingSessions,
        can_ask: remainingSessions > 0,
      }),
      { status: 200 }
    )
  } catch (error) {
    return handleApiError(error)
  }
}

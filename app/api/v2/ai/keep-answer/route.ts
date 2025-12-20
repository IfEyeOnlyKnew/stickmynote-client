// v2 AI Keep Answer API: production-quality, save AI answer as attachment
import { db } from '@/lib/database/pg-client'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { handleApiError } from '@/lib/api/handle-api-error'

export const dynamic = 'force-dynamic'

// POST /api/v2/ai/keep-answer - Save AI answer as attachment
export async function POST(request: Request) {
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

    const { stickId, stickType, question, answer } = await request.json()

    if (!stickId || !stickType || !question || !answer) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400 })
    }

    // Find the most recent session for this stick and user
    const sessionResult = await db.query(
      `SELECT id FROM ai_answer_sessions
       WHERE user_id = $1 AND stick_id = $2 AND question = $3
       ORDER BY created_at DESC
       LIMIT 1`,
      [user.id, stickId, question]
    )

    const session = sessionResult.rows[0]

    if (!session) {
      return new Response(JSON.stringify({ error: 'Session not found' }), { status: 404 })
    }

    // Update session to mark as kept
    await db.query(`UPDATE ai_answer_sessions SET was_kept = true WHERE id = $1`, [session.id])

    // Create the attachment
    await db.query(
      `INSERT INTO ai_answer_attachments (session_id, stick_id, stick_type, question, answer, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [session.id, stickId, stickType, question, answer, user.id]
    )

    return new Response(JSON.stringify({ success: true }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

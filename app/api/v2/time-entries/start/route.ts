// v2 Time Entries Start API: production-quality, start a timer
import { type NextRequest } from 'next/server'
import { db } from '@/lib/database/pg-client'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { handleApiError } from '@/lib/api/handle-api-error'

export const dynamic = 'force-dynamic'

// POST /api/v2/time-entries/start - Start a new timer
export async function POST(request: NextRequest) {
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

    const { taskId } = await request.json()

    if (!taskId) {
      return new Response(JSON.stringify({ error: 'Task ID is required' }), { status: 400 })
    }

    // Check if there's already an active timer for this user
    const activeResult = await db.query(
      `SELECT id FROM time_entries WHERE user_id = $1 AND ended_at IS NULL`,
      [user.id]
    )

    if (activeResult.rows.length > 0) {
      return new Response(
        JSON.stringify({ error: 'You already have an active timer running' }),
        { status: 400 }
      )
    }

    // Create new time entry
    const result = await db.query(
      `INSERT INTO time_entries (task_id, user_id, started_at)
       VALUES ($1, $2, NOW())
       RETURNING *`,
      [taskId, user.id]
    )

    return new Response(JSON.stringify(result.rows[0]), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

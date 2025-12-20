// v2 Time Entries Stop API: production-quality, stop a timer
import { type NextRequest } from 'next/server'
import { db } from '@/lib/database/pg-client'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { handleApiError } from '@/lib/api/handle-api-error'

export const dynamic = 'force-dynamic'

// POST /api/v2/time-entries/[id]/stop - Stop a timer
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

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

    // Fetch the entry
    const entryResult = await db.query(
      `SELECT started_at, user_id, task_id FROM time_entries WHERE id = $1`,
      [id]
    )

    if (entryResult.rows.length === 0) {
      return new Response(JSON.stringify({ error: 'Time entry not found' }), { status: 404 })
    }

    const entry = entryResult.rows[0]

    if (entry.user_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 403 })
    }

    const endedAt = new Date()
    const startedAt = new Date(entry.started_at)
    const durationSeconds = Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000)

    // Update the time entry
    const updateResult = await db.query(
      `UPDATE time_entries
       SET ended_at = $1, duration_seconds = $2, updated_at = $1
       WHERE id = $3
       RETURNING *`,
      [endedAt.toISOString(), durationSeconds, id]
    )

    // Update task's actual hours
    const hours = durationSeconds / 3600
    const taskResult = await db.query(
      `SELECT calstick_actual_hours FROM paks_pad_stick_replies WHERE id = $1`,
      [entry.task_id]
    )

    if (taskResult.rows.length > 0) {
      const currentHours = taskResult.rows[0].calstick_actual_hours || 0
      await db.query(
        `UPDATE paks_pad_stick_replies
         SET calstick_actual_hours = $1
         WHERE id = $2`,
        [currentHours + hours, entry.task_id]
      )
    }

    return new Response(JSON.stringify(updateResult.rows[0]), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

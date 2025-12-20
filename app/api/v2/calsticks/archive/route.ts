// v2 Calsticks Archive API: production-quality, archive/unarchive calsticks
import { type NextRequest } from 'next/server'
import { db } from '@/lib/database/pg-client'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { handleApiError } from '@/lib/api/handle-api-error'

export const dynamic = 'force-dynamic'

const DEFAULT_AUTO_ARCHIVE_DAYS = 14
const DEFAULT_PAGE = 1
const DEFAULT_LIMIT = 20

// POST /api/v2/calsticks/archive - Archive tasks
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

    const body = await request.json()
    const { taskIds, archiveAll } = body

    if (archiveAll) {
      const userPrefsResult = await db.query(
        `SELECT calstick_auto_archive_days FROM users WHERE id = $1`,
        [user.id]
      )

      const autoArchiveDays =
        userPrefsResult.rows[0]?.calstick_auto_archive_days ?? DEFAULT_AUTO_ARCHIVE_DAYS
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - autoArchiveDays)

      const result = await db.query(
        `UPDATE calstick_tasks
         SET is_archived = true, archived_at = NOW()
         WHERE user_id = $1 AND calstick_completed = true AND is_archived = false
         AND calstick_completed_at < $2
         RETURNING id`,
        [user.id, cutoffDate.toISOString()]
      )

      return new Response(
        JSON.stringify({ success: true, archivedCount: result.rows.length }),
        { status: 200 }
      )
    }

    if (taskIds?.length) {
      await db.query(
        `UPDATE calstick_tasks SET is_archived = true, archived_at = NOW()
         WHERE id = ANY($1) AND user_id = $2`,
        [taskIds, user.id]
      )

      return new Response(
        JSON.stringify({ success: true, archivedCount: taskIds.length }),
        { status: 200 }
      )
    }

    return new Response(JSON.stringify({ error: 'No tasks specified' }), { status: 400 })
  } catch (error) {
    return handleApiError(error)
  }
}

// DELETE /api/v2/calsticks/archive - Unarchive task
export async function DELETE(request: NextRequest) {
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

    const { searchParams } = new URL(request.url)
    const taskId = searchParams.get('taskId')

    if (!taskId) {
      return new Response(JSON.stringify({ error: 'Task ID required' }), { status: 400 })
    }

    await db.query(
      `UPDATE calstick_tasks SET is_archived = false, archived_at = NULL
       WHERE id = $1 AND user_id = $2`,
      [taskId, user.id]
    )

    return new Response(JSON.stringify({ success: true }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

// GET /api/v2/calsticks/archive - Get archived tasks
export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url)
    const page = Number.parseInt(searchParams.get('page') ?? String(DEFAULT_PAGE))
    const limit = Number.parseInt(searchParams.get('limit') ?? String(DEFAULT_LIMIT))
    const offset = (page - 1) * limit

    const result = await db.query(
      `SELECT t.*,
              json_build_object('id', s.id, 'topic', s.topic, 'content', s.content,
                'pad', json_build_object('id', p.id, 'name', p.name)) as stick,
              json_build_object('id', u.id, 'full_name', u.full_name, 'email', u.email,
                'username', u.username, 'avatar_url', u.avatar_url) as user
       FROM calstick_tasks t
       LEFT JOIN sticks s ON t.stick_id = s.id
       LEFT JOIN pads p ON s.pad_id = p.id
       LEFT JOIN users u ON t.user_id = u.id
       WHERE t.user_id = $1 AND t.is_archived = true
       ORDER BY t.archived_at DESC
       LIMIT $2 OFFSET $3`,
      [user.id, limit, offset]
    )

    const countResult = await db.query(
      `SELECT COUNT(*) as count FROM calstick_tasks WHERE user_id = $1 AND is_archived = true`,
      [user.id]
    )

    const count = parseInt(countResult.rows[0]?.count || '0')

    return new Response(
      JSON.stringify({
        archivedTasks: result.rows,
        total: count,
        hasMore: count > offset + limit,
      }),
      { status: 200 }
    )
  } catch (error) {
    return handleApiError(error)
  }
}

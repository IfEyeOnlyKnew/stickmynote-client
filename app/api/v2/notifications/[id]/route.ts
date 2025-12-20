// v2 Notifications [id] API: production-quality, update/delete notification
import { type NextRequest } from 'next/server'
import { db } from '@/lib/database/pg-client'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { handleApiError } from '@/lib/api/handle-api-error'

export const dynamic = 'force-dynamic'

// PATCH /api/v2/notifications/[id] - Mark notification as read/unread
export async function PATCH(
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

    const body = await request.json()
    const { read } = body

    if (typeof read !== 'boolean') {
      return new Response(JSON.stringify({ error: 'Invalid read status' }), { status: 400 })
    }

    // Get current activity
    const activityResult = await db.query(
      `SELECT metadata FROM personal_sticks_activities WHERE id = $1`,
      [id]
    )

    if (activityResult.rows.length === 0) {
      return new Response(JSON.stringify({ error: 'Activity not found' }), { status: 404 })
    }

    const metadata = activityResult.rows[0].metadata || {}
    metadata.read = read

    // Update activity
    const updateResult = await db.query(
      `UPDATE personal_sticks_activities SET metadata = $1 WHERE id = $2 RETURNING *`,
      [JSON.stringify(metadata), id]
    )

    return new Response(JSON.stringify({ notification: updateResult.rows[0] }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

// DELETE /api/v2/notifications/[id] - Delete notification
export async function DELETE(
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

    await db.query(`DELETE FROM personal_sticks_activities WHERE id = $1`, [id])

    return new Response(JSON.stringify({ success: true }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

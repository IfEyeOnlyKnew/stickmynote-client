// v2 Notifications Mark All Read API: production-quality
import { type NextRequest } from 'next/server'
import { db } from '@/lib/database/pg-client'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { handleApiError } from '@/lib/api/handle-api-error'

export const dynamic = 'force-dynamic'

// POST /api/v2/notifications/mark-all-read - Mark all notifications as read
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

    // Get all unread activities
    const activitiesResult = await db.query(
      `SELECT id, metadata FROM personal_sticks_activities
       WHERE (metadata->>'read' IS NULL OR metadata->>'read' = 'false')`
    )

    // Update each activity to mark as read
    for (const activity of activitiesResult.rows) {
      const metadata = activity.metadata || {}
      metadata.read = true
      await db.query(
        `UPDATE personal_sticks_activities SET metadata = $1 WHERE id = $2`,
        [JSON.stringify(metadata), activity.id]
      )
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

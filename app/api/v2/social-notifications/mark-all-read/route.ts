// v2 Social Notifications Mark All Read API: production-quality, mark all as read
import { type NextRequest } from 'next/server'
import { db } from '@/lib/database/pg-client'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { getOrgContext } from '@/lib/auth/get-org-context'
import { handleApiError } from '@/lib/api/handle-api-error'

export const dynamic = 'force-dynamic'

// POST /api/v2/social-notifications/mark-all-read - Mark all social notifications as read
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

    const orgContext = await getOrgContext()
    if (!orgContext) {
      return new Response(JSON.stringify({ error: 'Organization context required' }), { status: 403 })
    }

    // Get pads where user is a member
    const memberPadsResult = await db.query(
      `SELECT social_pad_id FROM social_pad_members WHERE user_id = $1`,
      [user.id]
    )

    // Get pads owned by user
    const ownedPadsResult = await db.query(
      `SELECT id FROM social_pads WHERE owner_id = $1 AND org_id = $2`,
      [user.id, orgContext.orgId]
    )

    const padIds = [
      ...memberPadsResult.rows.map((m: any) => m.social_pad_id),
      ...ownedPadsResult.rows.map((p: any) => p.id),
    ]

    if (padIds.length === 0) {
      return new Response(JSON.stringify({ success: true }), { status: 200 })
    }

    // Get recent stick activities in user's pads (not by user)
    const stickActivitiesResult = await db.query(
      `SELECT id FROM social_sticks
       WHERE social_pad_id = ANY($1)
       AND org_id = $2
       AND user_id <> $3
       ORDER BY created_at DESC
       LIMIT 50`,
      [padIds, orgContext.orgId, user.id]
    )

    // Get recent reply activities
    const replyActivitiesResult = await db.query(
      `SELECT r.id, s.social_pad_id, s.user_id as stick_owner_id
       FROM social_stick_replies r
       JOIN social_sticks s ON r.social_stick_id = s.id
       WHERE r.org_id = $1
       AND r.user_id <> $2
       ORDER BY r.created_at DESC
       LIMIT 50`,
      [orgContext.orgId, user.id]
    )

    // Filter replies to only those in user's pads or on user's sticks
    const filteredReplies = replyActivitiesResult.rows.filter((reply: any) => {
      return padIds.includes(reply.social_pad_id) || reply.stick_owner_id === user.id
    })

    // Create notification keys for all activities
    const notificationKeys = [
      ...stickActivitiesResult.rows.map((stick: any) => `stick_${stick.id}`),
      ...filteredReplies.map((reply: any) => `reply_${reply.id}`),
    ]

    if (notificationKeys.length === 0) {
      return new Response(JSON.stringify({ success: true }), { status: 200 })
    }

    // Batch upsert all as read
    const now = new Date().toISOString()
    const values: any[] = []
    const placeholders: string[] = []
    notificationKeys.forEach((key, i) => {
      const baseIndex = i * 3
      placeholders.push(`($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3})`)
      values.push(user.id, key, now)
    })

    await db.query(
      `INSERT INTO social_notification_reads (user_id, notification_key, last_read_at)
       VALUES ${placeholders.join(', ')}
       ON CONFLICT (user_id, notification_key)
       DO UPDATE SET last_read_at = EXCLUDED.last_read_at`,
      values
    )

    return new Response(JSON.stringify({ success: true, marked: notificationKeys.length }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

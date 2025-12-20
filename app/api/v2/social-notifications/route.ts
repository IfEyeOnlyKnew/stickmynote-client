// v2 Social Notifications API: production-quality, get social notifications
import { type NextRequest } from 'next/server'
import { db } from '@/lib/database/pg-client'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { getOrgContext } from '@/lib/auth/get-org-context'
import { handleApiError } from '@/lib/api/handle-api-error'

export const dynamic = 'force-dynamic'

// GET /api/v2/social-notifications - Get social notifications for current user
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

    const orgContext = await getOrgContext()
    if (!orgContext) {
      return new Response(JSON.stringify({ error: 'Organization context required' }), { status: 403 })
    }

    // Get read notification keys
    const readNotificationsResult = await db.query(
      `SELECT notification_key FROM social_notification_reads WHERE user_id = $1`,
      [user.id]
    )
    const readKeys = new Set(readNotificationsResult.rows.map((r: any) => r.notification_key))

    // Get pads where user is a member
    const memberPadsResult = await db.query(
      `SELECT social_pad_id FROM social_pad_members WHERE user_id = $1 AND org_id = $2`,
      [user.id, orgContext.orgId]
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
      return new Response(JSON.stringify({ notifications: [] }), { status: 200 })
    }

    // Get recent stick activities in user's pads (not by user)
    const stickActivitiesResult = await db.query(
      `SELECT
        ss.id,
        ss.topic,
        ss.content,
        ss.created_at,
        ss.social_pad_id,
        ss.user_id,
        sp.name as pad_name
       FROM social_sticks ss
       INNER JOIN social_pads sp ON sp.id = ss.social_pad_id
       WHERE ss.social_pad_id = ANY($1)
         AND ss.user_id != $2
         AND ss.org_id = $3
       ORDER BY ss.created_at DESC
       LIMIT 25`,
      [padIds, user.id, orgContext.orgId]
    )

    // Get recent reply activities
    const replyActivitiesResult = await db.query(
      `SELECT
        ssr.id,
        ssr.content,
        ssr.created_at,
        ssr.social_stick_id,
        ssr.user_id,
        ss.id as stick_id,
        ss.topic as stick_topic,
        ss.social_pad_id,
        ss.user_id as stick_user_id,
        sp.name as pad_name
       FROM social_stick_replies ssr
       INNER JOIN social_sticks ss ON ss.id = ssr.social_stick_id
       INNER JOIN social_pads sp ON sp.id = ss.social_pad_id
       WHERE ssr.user_id != $1
         AND ssr.org_id = $2
       ORDER BY ssr.created_at DESC
       LIMIT 25`,
      [user.id, orgContext.orgId]
    )

    // Filter replies to only those in user's pads or on user's sticks
    const filteredReplies = replyActivitiesResult.rows.filter((reply: any) => {
      const padId = reply.social_pad_id
      const stickOwnerId = reply.stick_user_id
      return (padId && padIds.includes(padId)) || stickOwnerId === user.id
    })

    // Get user details for activity authors
    const userIds = new Set<string>()
    stickActivitiesResult.rows.forEach((stick: any) => userIds.add(stick.user_id))
    filteredReplies.forEach((reply: any) => userIds.add(reply.user_id))

    const usersResult = await db.query(
      `SELECT id, full_name, email, avatar_url FROM users WHERE id = ANY($1)`,
      [Array.from(userIds)]
    )
    const userMap = new Map(usersResult.rows.map((u: any) => [u.id, u]))

    // Group replies by stick, keeping only the most recent
    const replyByStick = new Map()
    filteredReplies.forEach((reply: any) => {
      const stickId = reply.social_stick_id
      if (!replyByStick.has(stickId) || new Date(reply.created_at) > new Date(replyByStick.get(stickId).created_at)) {
        replyByStick.set(stickId, reply)
      }
    })

    // Build notifications list
    const notifications = [
      ...stickActivitiesResult.rows.map((stick: any) => {
        const notificationKey = `stick_${stick.id}`
        return {
          id: notificationKey,
          activity_type: 'stick_created',
          note_id: stick.id,
          user_id: stick.user_id,
          created_at: stick.created_at,
          metadata: {
            stick_topic: stick.topic,
            pad_name: stick.pad_name,
            read: readKeys.has(notificationKey),
          },
          users: userMap.get(stick.user_id) || null,
        }
      }),
      ...Array.from(replyByStick.values()).map((reply: any) => {
        const notificationKey = `reply_${reply.id}`
        return {
          id: notificationKey,
          activity_type: 'stick_replied',
          note_id: reply.social_stick_id,
          user_id: reply.user_id,
          created_at: reply.created_at,
          metadata: {
            reply_content: reply.content?.substring(0, 100),
            stick_topic: reply.stick_topic,
            pad_name: reply.pad_name,
            read: readKeys.has(notificationKey),
          },
          users: userMap.get(reply.user_id) || null,
        }
      }),
    ]

    // Sort by created_at descending and limit to 50
    const sortedNotifications = notifications
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 50)

    return new Response(JSON.stringify({ notifications: sortedNotifications }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

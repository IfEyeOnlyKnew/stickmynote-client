// Inference Notifications handler - shared logic between v1 and v2 API routes
import { db } from '@/lib/database/pg-client'

// ============================================================================
// Types
// ============================================================================

export interface NotificationUser {
  id: string
  full_name: string | null
  email: string
  avatar_url: string | null
}

export interface Notification {
  id: string
  activity_type: string
  note_id: string
  user_id: string
  created_at: string
  metadata: Record<string, unknown>
  users: NotificationUser | null
}

export interface GetNotificationsOptions {
  /** Over-fetch limit for v1 pagination. When set, controls SQL LIMIT. */
  sqlLimit?: number
}

// ============================================================================
// Core Logic
// ============================================================================

/**
 * Fetch inference notifications for a user within an org.
 * Returns the merged, sorted list of stick-created and reply notifications.
 */
export async function getInferenceNotifications(
  userId: string,
  orgId: string,
  options?: GetNotificationsOptions
): Promise<Notification[]> {
  const sqlLimit = options?.sqlLimit ?? 25

  // Get read notification keys
  const readNotificationsResult = await db.query(
    `SELECT notification_key FROM inference_notification_reads WHERE user_id = $1`,
    [userId]
  )
  const readKeys = new Set(readNotificationsResult.rows.map((r: any) => r.notification_key))

  // Get pads where user is a member
  const memberPadsResult = await db.query(
    `SELECT social_pad_id FROM social_pad_members WHERE user_id = $1 AND org_id = $2`,
    [userId, orgId]
  )

  // Get pads owned by user
  const ownedPadsResult = await db.query(
    `SELECT id FROM social_pads WHERE owner_id = $1 AND org_id = $2`,
    [userId, orgId]
  )

  const padIds = [
    ...memberPadsResult.rows.map((m: any) => m.social_pad_id),
    ...ownedPadsResult.rows.map((p: any) => p.id),
  ]

  if (padIds.length === 0) {
    return []
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
     LIMIT $4`,
    [padIds, userId, orgId, sqlLimit]
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
     LIMIT $3`,
    [userId, orgId, sqlLimit]
  )

  // Filter replies to only those in user's pads or on user's sticks
  const filteredReplies = replyActivitiesResult.rows.filter((reply: any) => {
    const padId = reply.social_pad_id
    const stickOwnerId = reply.stick_user_id
    return (padId && padIds.includes(padId)) || stickOwnerId === userId
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
  const notifications: Notification[] = [
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

  // Sort by created_at descending
  return notifications.toSorted(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )
}

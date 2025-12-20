// Social handler logic - extracted for testability
import { query, querySingle } from '@/lib/database/pg-helpers'
import { requireId, requireString } from '@/lib/api/validate'

export interface SocialSession {
  user: { id: string; org_id?: string }
}

export interface CreateSocialInput {
  type: string
  value: string
}

// List social notifications for user/org
export async function listSocialNotifications(session: SocialSession, limit = 50, offset = 0) {
  try {
    const notifications = await query(
      `SELECT * FROM social_notifications WHERE org_id = $1 AND user_id = $2 ORDER BY created_at DESC LIMIT $3 OFFSET $4`,
      [session.user.org_id, session.user.id, limit, offset]
    )
    return { status: 200, body: { social: notifications } }
  } catch (error) {
    return { status: 500, body: { error: 'Failed to list social notifications' } }
  }
}

// Create a social connection/notification
export async function createSocialNotification(session: SocialSession, input: CreateSocialInput) {
  try {
    const type = requireString(input.type, 'type')
    const value = requireString(input.value, 'value')
    const now = new Date().toISOString()
    const social = await querySingle(
      `INSERT INTO social_notifications (user_id, org_id, type, value, created_at)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [session.user.id, session.user.org_id, type, value, now]
    )
    return { status: 201, body: { social } }
  } catch (error: any) {
    if (error?.message) {
      return { status: 400, body: { error: error.message } }
    }
    return { status: 500, body: { error: 'Failed to create social notification' } }
  }
}

// Mark a notification as read
export async function markNotificationRead(session: SocialSession, notificationId: string) {
  try {
    const id = requireId(notificationId, 'id')
    const updated = await querySingle(
      `UPDATE social_notifications SET read = true, read_at = NOW() WHERE id = $1 AND user_id = $2 AND org_id = $3 RETURNING id`,
      [id, session.user.id, session.user.org_id]
    )
    if (!updated) {
      return { status: 404, body: { error: 'Notification not found or not owned by user' } }
    }
    return { status: 200, body: { success: true } }
  } catch (error: any) {
    if (error?.message) {
      return { status: 400, body: { error: error.message } }
    }
    return { status: 500, body: { error: 'Failed to mark notification as read' } }
  }
}

// Mark all notifications as read
export async function markAllNotificationsRead(session: SocialSession) {
  try {
    await query(
      `UPDATE social_notifications SET read = true, read_at = NOW() WHERE user_id = $1 AND org_id = $2 AND read = false`,
      [session.user.id, session.user.org_id]
    )
    return { status: 200, body: { success: true } }
  } catch (error) {
    return { status: 500, body: { error: 'Failed to mark all notifications as read' } }
  }
}

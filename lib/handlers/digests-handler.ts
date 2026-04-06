// Digests handler logic - extracted for v1/v2 deduplication
import { db } from '@/lib/database/pg-client'
import {
  generateDigestEmailHtml,
  generateDigestPlainText,
  type DigestEmailData,
  type PadDigestSummary,
  type DigestNotification,
} from '@/lib/email/digest-templates'
import { sendEmail } from '@/lib/email/resend'

export interface DigestUser {
  id: string
}

// ============================================================================
// Shared: Build digest data from notifications
// ============================================================================

export async function buildDigestData(
  userId: string,
  frequency: 'daily' | 'weekly',
): Promise<{
  digestData: DigestEmailData
  notifications: any[]
  profile: { full_name?: string; email?: string } | null
}> {
  const now = new Date()
  const periodEnd = now
  const periodStart = new Date(now)
  if (frequency === 'daily') {
    periodStart.setDate(periodStart.getDate() - 1)
  } else {
    periodStart.setDate(periodStart.getDate() - 7)
  }

  // Fetch recent notifications
  const notificationsResult = await db.query(
    `SELECT * FROM notifications
     WHERE user_id = $1 AND created_at >= $2
     ORDER BY created_at DESC
     LIMIT 50`,
    [userId, periodStart.toISOString()],
  )
  const notifications = notificationsResult.rows

  // Fetch user profile
  const profileResult = await db.query(
    `SELECT full_name, email FROM users WHERE id = $1`,
    [userId],
  )
  const profile = profileResult.rows[0] || null

  // Group by pad
  const padMap = new Map<string, PadDigestSummary>()

  for (const notif of notifications) {
    const padId = (notif.metadata?.pad_id as string) || 'general'
    const padName = (notif.metadata?.pad_name as string) || 'General'

    if (!padMap.has(padId)) {
      padMap.set(padId, {
        padId,
        padName,
        newSticks: 0,
        statusChanges: 0,
        unresolvedBlockers: 0,
        mentions: 0,
        replies: 0,
        notifications: [],
      })
    }

    const summary = padMap.get(padId)!
    const digestNotif: DigestNotification = {
      id: notif.id,
      type: notif.type,
      title: notif.title,
      message: notif.message,
      created_at: notif.created_at,
      action_url: notif.action_url,
      metadata: notif.metadata,
    }
    summary.notifications.push(digestNotif)

    switch (notif.type) {
      case 'stick_created':
        summary.newSticks++
        break
      case 'stick_updated':
      case 'status_changed':
        summary.statusChanges++
        break
      case 'blocker':
      case 'blocker_created':
        summary.unresolvedBlockers++
        break
      case 'mention':
      case 'mentioned':
        summary.mentions++
        break
      case 'reply':
      case 'stick_replied':
        summary.replies++
        break
    }
  }

  const padSummaries = Array.from(padMap.values()).sort(
    (a, b) => b.notifications.length - a.notifications.length,
  )

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.stickmynote.com'

  const digestData: DigestEmailData = {
    userName: profile?.full_name || '',
    frequency,
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
    totalNotifications: notifications.length,
    padSummaries,
    siteUrl,
  }

  return { digestData, notifications, profile }
}

// ============================================================================
// GET: Preview digest email HTML
// ============================================================================

export async function previewDigest(
  user: DigestUser,
  frequency: 'daily' | 'weekly',
): Promise<string> {
  const { digestData } = await buildDigestData(user.id, frequency)
  return generateDigestEmailHtml(digestData)
}

// ============================================================================
// POST: Send test digest email
// ============================================================================

export async function sendTestDigest(
  user: DigestUser,
  frequency: 'daily' | 'weekly',
): Promise<{ success: boolean; emailId?: string; notificationCount: number; error?: string }> {
  const { digestData, notifications, profile } = await buildDigestData(user.id, frequency)

  if (!profile?.email) {
    return { success: false, notificationCount: 0, error: 'No email address found' }
  }

  const html = generateDigestEmailHtml(digestData)
  const text = generateDigestPlainText(digestData)

  const result = await sendEmail({
    to: profile.email,
    subject: `[Test] Your ${frequency === 'daily' ? 'Daily' : 'Weekly'} Digest - ${notifications.length} update${notifications.length === 1 ? '' : 's'}`,
    html,
    text,
  })

  if (!result.success) {
    return { success: false, notificationCount: 0, error: result.error }
  }

  return {
    success: true,
    emailId: result.id,
    notificationCount: notifications.length,
  }
}

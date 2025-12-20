// v2 Digests Preview API: production-quality, preview digest email
import { type NextRequest } from 'next/server'
import { db } from '@/lib/database/pg-client'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { handleApiError } from '@/lib/api/handle-api-error'
import {
  generateDigestEmailHtml,
  type DigestEmailData,
  type PadDigestSummary,
  type DigestNotification,
} from '@/lib/email/digest-templates'

export const dynamic = 'force-dynamic'

// GET /api/v2/digests/preview - Preview digest email
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
    const frequency = (searchParams.get('frequency') || 'daily') as 'daily' | 'weekly'

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
      [user.id, periodStart.toISOString()]
    )
    const notifications = notificationsResult.rows

    // Fetch user profile
    const profileResult = await db.query(
      `SELECT full_name FROM users WHERE id = $1`,
      [user.id]
    )
    const profile = profileResult.rows[0]

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
      (a, b) => b.notifications.length - a.notifications.length
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

    const html = generateDigestEmailHtml(digestData)

    return new Response(html, {
      headers: { 'Content-Type': 'text/html' },
    })
  } catch (error) {
    return handleApiError(error)
  }
}

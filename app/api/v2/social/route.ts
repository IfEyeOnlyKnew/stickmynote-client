// v2 Social Notifications API route - uses extracted handler for testability
import { NextRequest } from 'next/server'
import { requireADSession } from '@/lib/auth/ad-session'
import { listSocialNotifications, createSocialNotification, markNotificationRead, markAllNotificationsRead } from '@/lib/handlers/social-handler'

// GET /api/v2/social - List notifications for user/org
export async function GET(request: NextRequest) {
  try {
    const session = await requireADSession(request)
    const url = new URL(request.url)
    const limit = Math.min(Number(url.searchParams.get('limit') || '50'), 100)
    const offset = Math.max(Number(url.searchParams.get('offset') || '0'), 0)
    const result = await listSocialNotifications(session, limit, offset)
    return new Response(JSON.stringify(result.body), { status: result.status })
  } catch (error) {
    if (error instanceof Response) return error
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }
}

// POST /api/v2/social - Create a social notification
export async function POST(request: NextRequest) {
  try {
    const session = await requireADSession(request)
    const body = await request.json()
    const result = await createSocialNotification(session, body)
    return new Response(JSON.stringify(result.body), { status: result.status })
  } catch (error) {
    if (error instanceof Response) return error
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }
}

// PATCH /api/v2/social/mark-read?id=... - Mark notification as read
export async function PATCH(request: NextRequest) {
  try {
    const session = await requireADSession(request)
    const url = new URL(request.url)
    const notificationId = url.searchParams.get('id') || ''
    const result = await markNotificationRead(session, notificationId)
    return new Response(JSON.stringify(result.body), { status: result.status })
  } catch (error) {
    if (error instanceof Response) return error
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }
}

// PUT /api/v2/social/mark-all-read - Mark all notifications as read
export async function PUT(request: NextRequest) {
  try {
    const session = await requireADSession(request)
    const result = await markAllNotificationsRead(session)
    return new Response(JSON.stringify(result.body), { status: result.status })
  } catch (error) {
    if (error instanceof Response) return error
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }
}

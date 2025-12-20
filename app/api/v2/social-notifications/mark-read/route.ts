// v2 Social Notifications Mark Read API: production-quality, mark single notification as read
import { type NextRequest } from 'next/server'
import { db } from '@/lib/database/pg-client'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { getOrgContext } from '@/lib/auth/get-org-context'
import { handleApiError } from '@/lib/api/handle-api-error'

export const dynamic = 'force-dynamic'

// POST /api/v2/social-notifications/mark-read - Mark a single notification as read
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
      return new Response(JSON.stringify({ error: 'No organization context' }), { status: 403 })
    }

    const body = await request.json()
    const { notificationKey } = body

    if (!notificationKey) {
      return new Response(JSON.stringify({ error: 'Notification key required' }), { status: 400 })
    }

    await db.query(
      `INSERT INTO social_notification_reads (user_id, notification_key, last_read_at, org_id)
       VALUES ($1, $2, NOW(), $3)
       ON CONFLICT (user_id, notification_key)
       DO UPDATE SET last_read_at = NOW()`,
      [user.id, notificationKey, orgContext.orgId]
    )

    return new Response(JSON.stringify({ success: true }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

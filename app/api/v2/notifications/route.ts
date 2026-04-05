// v2 Notifications API: production-quality, manage notifications
import { type NextRequest } from 'next/server'
import { db } from '@/lib/database/pg-client'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { getOrgContext } from '@/lib/auth/get-org-context'
import { handleApiError } from '@/lib/api/handle-api-error'

export const dynamic = 'force-dynamic'

// GET /api/v2/notifications - Fetch user notifications
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
      return new Response(JSON.stringify({ error: 'No organization context' }), { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const limit = Number.parseInt(searchParams.get('limit') || '50')
    const unreadOnly = searchParams.get('unread') === 'true'

    let queryStr = `SELECT * FROM notifications WHERE user_id = $1 AND org_id = $2`
    const params: any[] = [user.id, orgContext.orgId]

    if (unreadOnly) {
      queryStr += ` AND is_read = false`
    }

    queryStr += ` ORDER BY created_at DESC LIMIT $3`
    params.push(limit)

    const result = await db.query(queryStr, params)

    return new Response(JSON.stringify({ notifications: result.rows || [] }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

// POST /api/v2/notifications - Create a notification (system use)
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
    const { user_id, type, title, message, related_id, related_type, action_url, metadata } = body

    if (!user_id || !type || !title || !message) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400 })
    }

    const result = await db.query(
      `INSERT INTO notifications (user_id, type, title, message, related_id, related_type, action_url, created_by, metadata, org_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [user_id, type, title, message, related_id, related_type, action_url, user.id, JSON.stringify(metadata || {}), orgContext.orgId]
    )

    return new Response(JSON.stringify({ notification: result.rows[0] }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

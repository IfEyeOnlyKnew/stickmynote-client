// v2 Webhooks Logs API: production-quality, get webhook delivery logs
import { type NextRequest } from 'next/server'
import { db } from '@/lib/database/pg-client'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { handleApiError } from '@/lib/api/handle-api-error'

export const dynamic = 'force-dynamic'

// GET /api/v2/webhooks/config/[webhookId]/logs - Get delivery logs
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ webhookId: string }> }
) {
  try {
    const { webhookId } = await params

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

    // Verify webhook ownership
    const webhookResult = await db.query(
      `SELECT id FROM webhook_configurations WHERE id = $1 AND user_id = $2`,
      [webhookId, user.id]
    )

    if (webhookResult.rows.length === 0) {
      return new Response(JSON.stringify({ error: 'Webhook not found' }), { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const status = searchParams.get('status')

    let queryStr = `SELECT * FROM webhook_delivery_logs WHERE webhook_id = $1`
    const params_arr: any[] = [webhookId]

    if (status) {
      queryStr += ` AND status = $2`
      params_arr.push(status)
    }

    queryStr += ` ORDER BY created_at DESC LIMIT $${params_arr.length + 1}`
    params_arr.push(limit)

    const result = await db.query(queryStr, params_arr)

    return new Response(JSON.stringify({ logs: result.rows }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

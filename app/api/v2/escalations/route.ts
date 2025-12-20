// v2 Escalations API: production-quality, get notification escalations
import { type NextRequest } from 'next/server'
import { db } from '@/lib/database/pg-client'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { handleApiError } from '@/lib/api/handle-api-error'

export const dynamic = 'force-dynamic'

// GET /api/v2/escalations - Get user's notification escalations
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
    const status = searchParams.get('status')

    let query = `
      SELECT
        ne.*,
        ner.id as rule_id, ner.name as rule_name, ner.trigger_type, ner.escalation_channel
      FROM notification_escalations ne
      LEFT JOIN notification_escalation_rules ner ON ner.id = ne.rule_id
      WHERE ne.user_id = $1`

    const params: any[] = [user.id]

    if (status) {
      query += ` AND ne.status = $2`
      params.push(status)
    }

    query += ` ORDER BY ne.created_at DESC LIMIT 50`

    const result = await db.query(query, params)

    // Format response to include rule as nested object
    const escalations = result.rows.map((row: any) => ({
      id: row.id,
      user_id: row.user_id,
      rule_id: row.rule_id,
      status: row.status,
      notification_id: row.notification_id,
      escalation_count: row.escalation_count,
      last_escalated_at: row.last_escalated_at,
      acknowledged_at: row.acknowledged_at,
      acknowledged_by: row.acknowledged_by,
      snoozed_until: row.snoozed_until,
      created_at: row.created_at,
      updated_at: row.updated_at,
      rule: row.rule_id ? {
        id: row.rule_id,
        name: row.rule_name,
        trigger_type: row.trigger_type,
        escalation_channel: row.escalation_channel,
      } : null,
    }))

    return new Response(JSON.stringify({ escalations }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

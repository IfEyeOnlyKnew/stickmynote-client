// v2 Escalation Rules API: production-quality, manage escalation rules
import { type NextRequest } from 'next/server'
import { db } from '@/lib/database/pg-client'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { handleApiError } from '@/lib/api/handle-api-error'

export const dynamic = 'force-dynamic'

// GET /api/v2/escalation-rules - Get user's escalation rules
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

    const result = await db.query(
      `SELECT * FROM notification_escalation_rules
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [user.id]
    )

    return new Response(JSON.stringify({ rules: result.rows }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

// POST /api/v2/escalation-rules - Create an escalation rule
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

    const body = await request.json()

    const result = await db.query(
      `INSERT INTO notification_escalation_rules (
        user_id, name, description, trigger_type, trigger_conditions,
        escalation_channel, channel_config, cooldown_minutes,
        max_escalations, pad_ids, is_active
      )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        user.id,
        body.name,
        body.description,
        body.trigger_type,
        JSON.stringify(body.trigger_conditions || {}),
        body.escalation_channel,
        JSON.stringify(body.channel_config || {}),
        body.cooldown_minutes || 60,
        body.max_escalations || 3,
        body.pad_ids ? JSON.stringify(body.pad_ids) : '[]',
        body.is_active ?? true,
      ]
    )

    return new Response(JSON.stringify({ rule: result.rows[0] }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

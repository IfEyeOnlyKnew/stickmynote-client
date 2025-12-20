// v2 Escalation Rules [ruleId] API: production-quality, manage single rule
import { type NextRequest } from 'next/server'
import { db } from '@/lib/database/pg-client'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { handleApiError } from '@/lib/api/handle-api-error'

export const dynamic = 'force-dynamic'

// GET /api/v2/escalation-rules/[ruleId] - Get a specific rule
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ ruleId: string }> }
) {
  try {
    const { ruleId } = await params

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
       WHERE id = $1 AND user_id = $2`,
      [ruleId, user.id]
    )

    if (result.rows.length === 0) {
      return new Response(JSON.stringify({ error: 'Rule not found' }), { status: 404 })
    }

    return new Response(JSON.stringify({ rule: result.rows[0] }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

// PATCH /api/v2/escalation-rules/[ruleId] - Update a rule
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ ruleId: string }> }
) {
  try {
    const { ruleId } = await params

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

    // Build update query dynamically
    const updates: string[] = []
    const values: any[] = []
    let paramIndex = 1

    const allowedFields = [
      'name', 'description', 'trigger_type', 'trigger_conditions',
      'escalation_channel', 'channel_config', 'cooldown_minutes',
      'max_escalations', 'pad_ids', 'is_active'
    ]

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        const value = ['trigger_conditions', 'channel_config', 'pad_ids'].includes(field)
          ? JSON.stringify(body[field])
          : body[field]
        updates.push(`${field} = $${paramIndex}`)
        values.push(value)
        paramIndex++
      }
    }

    if (updates.length === 0) {
      return new Response(JSON.stringify({ error: 'No fields to update' }), { status: 400 })
    }

    updates.push(`updated_at = NOW()`)

    values.push(ruleId, user.id)

    const result = await db.query(
      `UPDATE notification_escalation_rules
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1}
       RETURNING *`,
      values
    )

    if (result.rows.length === 0) {
      return new Response(JSON.stringify({ error: 'Rule not found' }), { status: 404 })
    }

    return new Response(JSON.stringify({ rule: result.rows[0] }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

// DELETE /api/v2/escalation-rules/[ruleId] - Delete a rule
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ ruleId: string }> }
) {
  try {
    const { ruleId } = await params

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

    await db.query(
      `DELETE FROM notification_escalation_rules WHERE id = $1 AND user_id = $2`,
      [ruleId, user.id]
    )

    return new Response(JSON.stringify({ success: true }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

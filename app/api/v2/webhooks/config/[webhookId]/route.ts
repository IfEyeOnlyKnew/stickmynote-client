// v2 Webhooks Config [webhookId] API: production-quality, get/update/delete webhook
import { type NextRequest } from 'next/server'
import { db } from '@/lib/database/pg-client'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { handleApiError } from '@/lib/api/handle-api-error'

export const dynamic = 'force-dynamic'

// GET /api/v2/webhooks/config/[webhookId] - Get webhook details
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

    const result = await db.query(
      `SELECT * FROM webhook_configurations WHERE id = $1 AND user_id = $2`,
      [webhookId, user.id]
    )

    if (result.rows.length === 0) {
      return new Response(JSON.stringify({ error: 'Webhook not found' }), { status: 404 })
    }

    return new Response(JSON.stringify({ webhook: result.rows[0] }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

// PATCH /api/v2/webhooks/config/[webhookId] - Update webhook
export async function PATCH(
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

    const body = await request.json()

    // Don't allow updating signing_secret through this endpoint
    const { signing_secret: _, ...updateData } = body

    const updates: string[] = ['updated_at = NOW()']
    const values: any[] = []
    let paramIndex = 1

    if (updateData.name !== undefined) {
      updates.push(`name = $${paramIndex++}`)
      values.push(updateData.name)
    }
    if (updateData.description !== undefined) {
      updates.push(`description = $${paramIndex++}`)
      values.push(updateData.description)
    }
    if (updateData.url !== undefined) {
      updates.push(`url = $${paramIndex++}`)
      values.push(updateData.url)
    }
    if (updateData.headers !== undefined) {
      updates.push(`headers = $${paramIndex++}`)
      values.push(JSON.stringify(updateData.headers))
    }
    if (updateData.event_types !== undefined) {
      updates.push(`event_types = $${paramIndex++}`)
      values.push(updateData.event_types)
    }
    if (updateData.pad_ids !== undefined) {
      updates.push(`pad_ids = $${paramIndex++}`)
      values.push(updateData.pad_ids)
    }
    if (updateData.is_active !== undefined) {
      updates.push(`is_active = $${paramIndex++}`)
      values.push(updateData.is_active)
    }

    values.push(webhookId, user.id)

    const result = await db.query(
      `UPDATE webhook_configurations SET ${updates.join(', ')}
       WHERE id = $${paramIndex++} AND user_id = $${paramIndex}
       RETURNING *`,
      values
    )

    return new Response(JSON.stringify({ webhook: result.rows[0] }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

// DELETE /api/v2/webhooks/config/[webhookId] - Delete webhook
export async function DELETE(
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

    await db.query(
      `DELETE FROM webhook_configurations WHERE id = $1 AND user_id = $2`,
      [webhookId, user.id]
    )

    return new Response(JSON.stringify({ success: true }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

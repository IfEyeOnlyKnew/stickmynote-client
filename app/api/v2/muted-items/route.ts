// v2 Muted Items API: production-quality, manage muted notification items
import { type NextRequest } from 'next/server'
import { db } from '@/lib/database/pg-client'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { handleApiError } from '@/lib/api/handle-api-error'

export const dynamic = 'force-dynamic'

// GET /api/v2/muted-items - Get user's muted items
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
      `SELECT * FROM notification_muted_items
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [user.id]
    )

    return new Response(JSON.stringify({ mutedItems: result.rows }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

// POST /api/v2/muted-items - Mute an item
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
    const { entity_type, entity_id, muted_until, reason } = body

    const result = await db.query(
      `INSERT INTO notification_muted_items (user_id, entity_type, entity_id, muted_until, reason)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, entity_type, entity_id)
       DO UPDATE SET muted_until = EXCLUDED.muted_until, reason = EXCLUDED.reason, updated_at = NOW()
       RETURNING *`,
      [user.id, entity_type, entity_id, muted_until || null, reason]
    )

    return new Response(JSON.stringify({ mutedItem: result.rows[0] }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

// DELETE /api/v2/muted-items - Unmute an item
export async function DELETE(request: NextRequest) {
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
    const entityType = searchParams.get('entity_type')
    const entityId = searchParams.get('entity_id')

    if (!entityType || !entityId) {
      return new Response(
        JSON.stringify({ error: 'entity_type and entity_id are required' }),
        { status: 400 }
      )
    }

    await db.query(
      `DELETE FROM notification_muted_items
       WHERE user_id = $1 AND entity_type = $2 AND entity_id = $3`,
      [user.id, entityType, entityId]
    )

    return new Response(JSON.stringify({ success: true }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

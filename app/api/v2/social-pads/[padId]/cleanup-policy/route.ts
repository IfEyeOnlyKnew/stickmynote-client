// v2 Social Pads Cleanup Policy API: production-quality, manage cleanup policies
import { type NextRequest } from 'next/server'
import { db } from '@/lib/database/pg-client'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { handleApiError } from '@/lib/api/handle-api-error'

export const dynamic = 'force-dynamic'

const DEFAULT_POLICY = {
  auto_archive_enabled: false,
  archive_after_days: 90,
  archive_after_replies: null,
  auto_delete_enabled: false,
  delete_archived_after_days: 180,
  max_sticks_per_pad: null,
  max_sticks_per_user: null,
  auto_close_resolved_enabled: false,
  close_resolved_after_days: 7,
  exempt_pinned_sticks: true,
  exempt_workflow_active: true,
}

// GET /api/v2/social-pads/[padId]/cleanup-policy - Get cleanup policy
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ padId: string }> }
) {
  try {
    const { padId } = await params

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

    // Check ownership/admin
    const padResult = await db.query(
      `SELECT owner_id FROM social_pads WHERE id = $1`,
      [padId]
    )

    if (padResult.rows.length === 0) {
      return new Response(JSON.stringify({ error: 'Pad not found' }), { status: 404 })
    }

    const isOwner = padResult.rows[0].owner_id === user.id

    const membershipResult = await db.query(
      `SELECT role FROM social_pad_members
       WHERE social_pad_id = $1 AND user_id = $2`,
      [padId, user.id]
    )

    const isAdmin = membershipResult.rows[0]?.role === 'admin' || membershipResult.rows[0]?.role === 'owner'

    if (!isOwner && !isAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 })
    }

    // Get cleanup policy
    const policyResult = await db.query(
      `SELECT * FROM social_pad_cleanup_policies WHERE social_pad_id = $1`,
      [padId]
    )

    if (policyResult.rows.length === 0) {
      return new Response(
        JSON.stringify({ policy: { social_pad_id: padId, ...DEFAULT_POLICY } }),
        { status: 200 }
      )
    }

    return new Response(JSON.stringify({ policy: policyResult.rows[0] }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

// PUT /api/v2/social-pads/[padId]/cleanup-policy - Update cleanup policy
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ padId: string }> }
) {
  try {
    const { padId } = await params

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

    // Check ownership
    const padResult = await db.query(
      `SELECT owner_id FROM social_pads WHERE id = $1`,
      [padId]
    )

    if (padResult.rows.length === 0) {
      return new Response(JSON.stringify({ error: 'Pad not found' }), { status: 404 })
    }

    if (padResult.rows[0].owner_id !== user.id) {
      return new Response(
        JSON.stringify({ error: 'Only pad owner can update cleanup policy' }),
        { status: 403 }
      )
    }

    const body = await request.json()

    // Validate and extract valid fields
    const validFields = [
      'auto_archive_enabled',
      'archive_after_days',
      'archive_after_replies',
      'auto_delete_enabled',
      'delete_archived_after_days',
      'max_sticks_per_pad',
      'max_sticks_per_user',
      'auto_close_resolved_enabled',
      'close_resolved_after_days',
      'exempt_pinned_sticks',
      'exempt_workflow_active',
    ]

    const updateData: Record<string, any> = {}
    for (const field of validFields) {
      if (field in body) {
        updateData[field] = body[field]
      }
    }

    // Upsert policy
    const result = await db.query(
      `INSERT INTO social_pad_cleanup_policies (social_pad_id, created_by, ${Object.keys(updateData).join(', ')})
       VALUES ($1, $2, ${Object.keys(updateData).map((_, i) => `$${i + 3}`).join(', ')})
       ON CONFLICT (social_pad_id) DO UPDATE SET
         ${Object.keys(updateData).map((k) => `${k} = EXCLUDED.${k}`).join(', ')},
         updated_at = NOW()
       RETURNING *`,
      [padId, user.id, ...Object.values(updateData)]
    )

    return new Response(JSON.stringify({ policy: result.rows[0] }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

// DELETE /api/v2/social-pads/[padId]/cleanup-policy - Delete cleanup policy
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ padId: string }> }
) {
  try {
    const { padId } = await params

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

    // Check ownership
    const padResult = await db.query(
      `SELECT owner_id FROM social_pads WHERE id = $1`,
      [padId]
    )

    if (padResult.rows.length === 0 || padResult.rows[0].owner_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 })
    }

    await db.query(
      `DELETE FROM social_pad_cleanup_policies WHERE social_pad_id = $1`,
      [padId]
    )

    return new Response(JSON.stringify({ success: true }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

// v2 Social Sticks [stickId] API: production-quality, get, update, delete stick
import { type NextRequest } from 'next/server'
import { db } from '@/lib/database/pg-client'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { getOrgContext } from '@/lib/auth/get-org-context'
import { handleApiError } from '@/lib/api/handle-api-error'
import { isUnderLegalHold } from '@/lib/legal-hold/check-hold'

export const dynamic = 'force-dynamic'

// GET /api/v2/social-sticks/[stickId] - Get stick with details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ stickId: string }> }
) {
  try {
    const { stickId } = await params

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
      return new Response(JSON.stringify({ error: 'Organization context required' }), { status: 401 })
    }

    // Fetch stick with pad info
    const stickResult = await db.query(
      `SELECT ss.*, sp.id as pad_id, sp.name as pad_name, sp.owner_id as pad_owner_id
       FROM social_sticks ss
       LEFT JOIN social_pads sp ON ss.social_pad_id = sp.id
       WHERE ss.id = $1 AND ss.org_id = $2`,
      [stickId, orgContext.orgId]
    )

    if (stickResult.rows.length === 0) {
      return new Response(JSON.stringify({ error: 'Stick not found' }), { status: 404 })
    }

    const stick = stickResult.rows[0]

    // Check access
    if (stick.pad_owner_id !== user.id) {
      const memberResult = await db.query(
        `SELECT role FROM social_pad_members
         WHERE social_pad_id = $1 AND user_id = $2 AND accepted = true AND org_id = $3`,
        [stick.social_pad_id, user.id, orgContext.orgId]
      )

      if (memberResult.rows.length === 0) {
        return new Response(JSON.stringify({ error: 'Access denied' }), { status: 403 })
      }
    }

    // Get details tab
    const detailsResult = await db.query(
      `SELECT tab_data FROM social_stick_tabs
       WHERE social_stick_id = $1 AND tab_type = 'details' AND org_id = $2`,
      [stickId, orgContext.orgId]
    )
    const details = detailsResult.rows[0]?.tab_data?.content || ''

    // Get replies with user info
    const repliesResult = await db.query(
      `SELECT r.*, u.id as user_id, u.full_name, u.username, u.email, u.avatar_url
       FROM social_stick_replies r
       LEFT JOIN users u ON r.user_id = u.id
       WHERE r.social_stick_id = $1 AND r.org_id = $2
       ORDER BY r.created_at ASC`,
      [stickId, orgContext.orgId]
    )

    const replies = repliesResult.rows.map((r: any) => ({
      ...r,
      users: {
        id: r.user_id,
        full_name: r.full_name,
        username: r.username,
        email: r.email,
        avatar_url: r.avatar_url,
      },
    }))

    return new Response(
      JSON.stringify({
        stick: {
          ...stick,
          social_pads: { id: stick.pad_id, name: stick.pad_name, owner_id: stick.pad_owner_id },
          details,
          replies,
        },
      }),
      { status: 200 }
    )
  } catch (error) {
    return handleApiError(error)
  }
}

// PATCH /api/v2/social-sticks/[stickId] - Update stick
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ stickId: string }> }
) {
  try {
    const { stickId } = await params

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
      return new Response(JSON.stringify({ error: 'Organization context required' }), { status: 401 })
    }

    // Fetch stick for access check
    const stickResult = await db.query(
      `SELECT ss.user_id, ss.social_pad_id, sp.owner_id as pad_owner_id
       FROM social_sticks ss
       LEFT JOIN social_pads sp ON ss.social_pad_id = sp.id
       WHERE ss.id = $1 AND ss.org_id = $2`,
      [stickId, orgContext.orgId]
    )

    if (stickResult.rows.length === 0) {
      return new Response(JSON.stringify({ error: 'Stick not found' }), { status: 404 })
    }

    const stick = stickResult.rows[0]

    // Check edit permission
    const memberResult = await db.query(
      `SELECT role FROM social_pad_members
       WHERE social_pad_id = $1 AND user_id = $2 AND accepted = true AND org_id = $3`,
      [stick.social_pad_id, user.id, orgContext.orgId]
    )

    const canEdit =
      stick.user_id === user.id ||
      stick.pad_owner_id === user.id ||
      memberResult.rows[0]?.role === 'admin' ||
      memberResult.rows[0]?.role === 'edit'

    if (!canEdit) {
      return new Response(JSON.stringify({ error: 'Permission denied' }), { status: 403 })
    }

    const body = await request.json()

    const updateResult = await db.query(
      `UPDATE social_sticks
       SET topic = COALESCE($1, topic),
           content = COALESCE($2, content),
           color = COALESCE($3, color),
           updated_at = NOW()
       WHERE id = $4 AND org_id = $5
       RETURNING *`,
      [body.topic, body.content, body.color, stickId, orgContext.orgId]
    )

    return new Response(JSON.stringify({ stick: updateResult.rows[0] }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

// DELETE /api/v2/social-sticks/[stickId] - Delete stick
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ stickId: string }> }
) {
  try {
    const { stickId } = await params

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
      return new Response(JSON.stringify({ error: 'Organization context required' }), { status: 401 })
    }

    // Fetch stick for access check
    const stickResult = await db.query(
      `SELECT ss.user_id, sp.owner_id as pad_owner_id
       FROM social_sticks ss
       LEFT JOIN social_pads sp ON ss.social_pad_id = sp.id
       WHERE ss.id = $1 AND ss.org_id = $2`,
      [stickId, orgContext.orgId]
    )

    if (stickResult.rows.length === 0) {
      return new Response(JSON.stringify({ error: 'Stick not found' }), { status: 404 })
    }

    const stick = stickResult.rows[0]

    // Only stick creator or pad owner can delete
    if (stick.user_id !== user.id && stick.pad_owner_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Permission denied' }), { status: 403 })
    }

    if (await isUnderLegalHold(user.id, orgContext.orgId)) {
      return new Response(JSON.stringify({ error: 'Content cannot be deleted: active legal hold' }), { status: 403 })
    }

    await db.query(
      `DELETE FROM social_sticks WHERE id = $1 AND org_id = $2`,
      [stickId, orgContext.orgId]
    )

    return new Response(JSON.stringify({ success: true }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

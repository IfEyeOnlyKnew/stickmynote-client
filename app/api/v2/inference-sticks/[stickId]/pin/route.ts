// v2 Social Sticks Pin API: production-quality, toggle and reorder pins
import { type NextRequest } from 'next/server'
import { db } from '@/lib/database/pg-client'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { getOrgContext } from '@/lib/auth/get-org-context'
import { handleApiError } from '@/lib/api/handle-api-error'

export const dynamic = 'force-dynamic'

// POST /api/v2/inference-sticks/[stickId]/pin - Toggle pin
export async function POST(
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
      return new Response(JSON.stringify({ error: 'Organization context required' }), { status: 403 })
    }

    // Get stick with pad info
    const stickResult = await db.query(
      `SELECT ss.social_pad_id, ss.is_pinned, sp.owner_id as pad_owner_id
       FROM social_sticks ss
       LEFT JOIN social_pads sp ON ss.social_pad_id = sp.id
       WHERE ss.id = $1 AND ss.org_id = $2`,
      [stickId, orgContext.orgId]
    )

    if (stickResult.rows.length === 0) {
      return new Response(JSON.stringify({ error: 'Stick not found' }), { status: 404 })
    }

    const stick = stickResult.rows[0]

    // Check permission
    const memberResult = await db.query(
      `SELECT role FROM social_pad_members
       WHERE social_pad_id = $1 AND user_id = $2 AND accepted = true AND org_id = $3`,
      [stick.social_pad_id, user.id, orgContext.orgId]
    )

    const canPin = stick.pad_owner_id === user.id || memberResult.rows[0]?.role === 'admin'

    if (!canPin) {
      return new Response(
        JSON.stringify({ error: 'Only pad owners and admins can pin sticks' }),
        { status: 403 }
      )
    }

    // Get next pin order
    const pinnedResult = await db.query(
      `SELECT COALESCE(MAX(pin_order), 0) as max_order
       FROM social_sticks
       WHERE social_pad_id = $1 AND is_pinned = true AND org_id = $2`,
      [stick.social_pad_id, orgContext.orgId]
    )
    const nextPinOrder = (pinnedResult.rows[0]?.max_order || 0) + 1

    // Toggle pin
    const newIsPinned = !stick.is_pinned
    const updateResult = await db.query(
      `UPDATE social_sticks
       SET is_pinned = $1,
           pinned_at = $2,
           pinned_by = $3,
           pin_order = $4,
           updated_at = NOW()
       WHERE id = $5 AND org_id = $6
       RETURNING *`,
      [
        newIsPinned,
        newIsPinned ? new Date().toISOString() : null,
        newIsPinned ? user.id : null,
        newIsPinned ? nextPinOrder : null,
        stickId,
        orgContext.orgId,
      ]
    )

    return new Response(JSON.stringify({ stick: updateResult.rows[0] }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

// PUT /api/v2/inference-sticks/[stickId]/pin - Reorder pinned stick
export async function PUT(
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
      return new Response(JSON.stringify({ error: 'Organization context required' }), { status: 403 })
    }

    const body = await request.json()
    const { pin_order } = body

    // Get stick
    const stickResult = await db.query(
      `SELECT ss.social_pad_id, ss.is_pinned, sp.owner_id as pad_owner_id
       FROM social_sticks ss
       LEFT JOIN social_pads sp ON ss.social_pad_id = sp.id
       WHERE ss.id = $1 AND ss.org_id = $2`,
      [stickId, orgContext.orgId]
    )

    if (stickResult.rows.length === 0 || !stickResult.rows[0].is_pinned) {
      return new Response(
        JSON.stringify({ error: 'Stick not found or not pinned' }),
        { status: 404 }
      )
    }

    const stick = stickResult.rows[0]

    // Check permission
    const memberResult = await db.query(
      `SELECT role FROM social_pad_members
       WHERE social_pad_id = $1 AND user_id = $2 AND accepted = true AND org_id = $3`,
      [stick.social_pad_id, user.id, orgContext.orgId]
    )

    const canReorder = stick.pad_owner_id === user.id || memberResult.rows[0]?.role === 'admin'

    if (!canReorder) {
      return new Response(
        JSON.stringify({ error: 'Only pad owners and admins can reorder pinned sticks' }),
        { status: 403 }
      )
    }

    const updateResult = await db.query(
      `UPDATE social_sticks
       SET pin_order = $1, updated_at = NOW()
       WHERE id = $2 AND org_id = $3
       RETURNING *`,
      [pin_order, stickId, orgContext.orgId]
    )

    return new Response(JSON.stringify({ stick: updateResult.rows[0] }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

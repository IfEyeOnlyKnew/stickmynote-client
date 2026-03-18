// v2 Social Sticks Replies API: production-quality, manage stick replies
import { type NextRequest } from 'next/server'
import { db } from '@/lib/database/pg-client'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { getOrgContext } from '@/lib/auth/get-org-context'
import { handleApiError } from '@/lib/api/handle-api-error'

export const dynamic = 'force-dynamic'

const DEFAULT_REPLY_COLOR = '#fef3c7'
const DEFAULT_CATEGORY = 'Answer'

// GET /api/v2/inference-sticks/[stickId]/replies - Get replies
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ stickId: string }> }
) {
  try {
    const { stickId } = await params

    const orgContext = await getOrgContext()
    const orgId = orgContext?.orgId

    let query = `SELECT r.*, u.id as uid, u.full_name, u.username, u.email, u.avatar_url
                 FROM social_stick_replies r
                 LEFT JOIN users u ON r.user_id = u.id
                 WHERE r.social_stick_id = $1`
    const queryParams: any[] = [stickId]

    if (orgId) {
      query += ` AND r.org_id = $2`
      queryParams.push(orgId)
    }

    query += ` ORDER BY r.created_at DESC`

    const result = await db.query(query, queryParams)

    const replies = result.rows.map((r: any) => ({
      ...r,
      users: {
        id: r.uid,
        full_name: r.full_name,
        username: r.username,
        email: r.email,
        avatar_url: r.avatar_url,
      },
    }))

    return new Response(JSON.stringify({ replies }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

// POST /api/v2/inference-sticks/[stickId]/replies - Create reply
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
      return new Response(JSON.stringify({ error: 'Organization context required' }), { status: 401 })
    }

    const body = await request.json()
    const { content, color, parent_reply_id, category } = body

    if (!content?.trim()) {
      return new Response(JSON.stringify({ error: 'Reply content is required' }), { status: 400 })
    }

    // Fetch stick and check access
    const stickResult = await db.query(
      `SELECT ss.social_pad_id, sp.owner_id as pad_owner_id
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

      if (memberResult.rows[0].role === 'viewer') {
        return new Response(JSON.stringify({ error: 'Viewers cannot reply to sticks' }), { status: 403 })
      }
    }

    // Insert reply
    const replyResult = await db.query(
      `INSERT INTO social_stick_replies
       (social_stick_id, user_id, content, color, parent_reply_id, category, org_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [stickId, user.id, content.trim(), color || DEFAULT_REPLY_COLOR, parent_reply_id || null, category || DEFAULT_CATEGORY, orgContext.orgId]
    )

    // Get user data for response
    const userResult = await db.query(
      `SELECT id, full_name, username, email, avatar_url FROM users WHERE id = $1`,
      [user.id]
    )

    return new Response(
      JSON.stringify({
        reply: { ...replyResult.rows[0], users: userResult.rows[0] || null },
      }),
      { status: 200 }
    )
  } catch (error) {
    return handleApiError(error)
  }
}

// PUT /api/v2/inference-sticks/[stickId]/replies - Update reply
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ stickId: string }> }
) {
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
      return new Response(JSON.stringify({ error: 'Organization context required' }), { status: 401 })
    }

    const body = await request.json()
    const { reply_id, content } = body

    if (!reply_id || !content?.trim()) {
      return new Response(
        JSON.stringify({ error: 'Reply ID and content are required' }),
        { status: 400 }
      )
    }

    // Check reply exists and ownership
    const existingResult = await db.query(
      `SELECT user_id FROM social_stick_replies WHERE id = $1 AND org_id = $2`,
      [reply_id, orgContext.orgId]
    )

    if (existingResult.rows.length === 0) {
      return new Response(JSON.stringify({ error: 'Reply not found' }), { status: 404 })
    }

    if (existingResult.rows[0].user_id !== user.id) {
      return new Response(
        JSON.stringify({ error: 'You can only edit your own replies' }),
        { status: 403 }
      )
    }

    const updateResult = await db.query(
      `UPDATE social_stick_replies
       SET content = $1, updated_at = NOW()
       WHERE id = $2 AND org_id = $3
       RETURNING *`,
      [content.trim(), reply_id, orgContext.orgId]
    )

    return new Response(JSON.stringify({ reply: updateResult.rows[0] }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

// DELETE /api/v2/inference-sticks/[stickId]/replies - Delete reply
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ stickId: string }> }
) {
  try {
    const { stickId } = await params
    const { searchParams } = new URL(request.url)
    const replyId = searchParams.get('replyId')

    if (!replyId) {
      return new Response(JSON.stringify({ error: 'Reply ID is required' }), { status: 400 })
    }

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

    // Get stick info for permission check
    const stickResult = await db.query(
      `SELECT ss.social_pad_id, sp.owner_id as pad_owner_id
       FROM social_sticks ss
       LEFT JOIN social_pads sp ON ss.social_pad_id = sp.id
       WHERE ss.id = $1 AND ss.org_id = $2`,
      [stickId, orgContext.orgId]
    )

    if (stickResult.rows.length === 0) {
      return new Response(JSON.stringify({ error: 'Stick not found' }), { status: 404 })
    }

    const stick = stickResult.rows[0]

    // Get reply info
    const replyResult = await db.query(
      `SELECT user_id FROM social_stick_replies WHERE id = $1 AND org_id = $2`,
      [replyId, orgContext.orgId]
    )

    if (replyResult.rows.length === 0) {
      return new Response(JSON.stringify({ error: 'Reply not found' }), { status: 404 })
    }

    // Check delete permission
    const memberResult = await db.query(
      `SELECT role FROM social_pad_members
       WHERE social_pad_id = $1 AND user_id = $2 AND accepted = true AND org_id = $3`,
      [stick.social_pad_id, user.id, orgContext.orgId]
    )

    const canDelete =
      replyResult.rows[0].user_id === user.id ||
      stick.pad_owner_id === user.id ||
      memberResult.rows[0]?.role === 'admin'

    if (!canDelete) {
      return new Response(
        JSON.stringify({ error: "You don't have permission to delete this reply" }),
        { status: 403 }
      )
    }

    await db.query(
      `DELETE FROM social_stick_replies WHERE id = $1 AND org_id = $2`,
      [replyId, orgContext.orgId]
    )

    return new Response(JSON.stringify({ success: true }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

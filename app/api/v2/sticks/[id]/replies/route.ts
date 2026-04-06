// v2 Sticks Replies API: production-quality, manage stick replies
import { type NextRequest } from 'next/server'
import { db } from '@/lib/database/pg-client'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { getOrgContext } from '@/lib/auth/get-org-context'
import { handleApiError } from '@/lib/api/handle-api-error'
import {
  DEFAULT_REPLY_COLOR,
  parseReplyInput,
} from '@/lib/handlers/stick-replies-handler'

export const dynamic = 'force-dynamic'

async function checkPadAccess(padId: string, userId: string, orgId: string) {
  // Check pad ownership
  const padResult = await db.query(
    `SELECT owner_id FROM paks_pads WHERE id = $1 AND org_id = $2`,
    [padId, orgId]
  )

  if (padResult.rows[0]?.owner_id === userId) {
    return true
  }

  // Check membership
  const memberResult = await db.query(
    `SELECT role FROM paks_pad_members WHERE pad_id = $1 AND user_id = $2`,
    [padId, userId]
  )

  return memberResult.rows.length > 0
}

// GET /api/v2/sticks/[id]/replies - Get replies
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: stickId } = await params

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

    // Get stick
    const stickResult = await db.query(
      `SELECT pad_id FROM paks_pad_sticks WHERE id = $1 AND org_id = $2`,
      [stickId, orgContext.orgId]
    )

    if (stickResult.rows.length === 0) {
      return new Response(JSON.stringify({ error: 'Stick not found' }), { status: 404 })
    }

    const hasAccess = await checkPadAccess(stickResult.rows[0].pad_id, user.id, orgContext.orgId)
    if (!hasAccess) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 })
    }

    // Get replies with user data
    const repliesResult = await db.query(
      `SELECT r.id, r.content, r.color, r.created_at, r.updated_at, r.user_id,
              r.is_calstick, r.calstick_date, r.calstick_completed, r.calstick_completed_at,
              u.username, u.email, u.full_name
       FROM paks_pad_stick_replies r
       LEFT JOIN users u ON r.user_id = u.id
       WHERE r.stick_id = $1 AND r.org_id = $2
       ORDER BY r.created_at ASC`,
      [stickId, orgContext.orgId]
    )

    const replies = repliesResult.rows.map((r: any) => ({
      ...r,
      user: { username: r.username, email: r.email, full_name: r.full_name },
    }))

    return new Response(JSON.stringify({ replies }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

// POST /api/v2/sticks/[id]/replies - Create reply
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: stickId } = await params

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
    const replyInput = parseReplyInput(body)

    if (!replyInput.content?.trim()) {
      return new Response(JSON.stringify({ error: 'Content is required' }), { status: 400 })
    }

    // Get stick
    const stickResult = await db.query(
      `SELECT pad_id FROM paks_pad_sticks WHERE id = $1 AND org_id = $2`,
      [stickId, orgContext.orgId]
    )

    if (stickResult.rows.length === 0) {
      return new Response(JSON.stringify({ error: 'Stick not found' }), { status: 404 })
    }

    const hasAccess = await checkPadAccess(stickResult.rows[0].pad_id, user.id, orgContext.orgId)
    if (!hasAccess) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 })
    }

    // Create reply
    const replyResult = await db.query(
      `INSERT INTO paks_pad_stick_replies
       (stick_id, user_id, org_id, content, color, is_calstick, calstick_date,
        calstick_status, calstick_priority, calstick_parent_id, calstick_assignee_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        stickId,
        user.id,
        orgContext.orgId,
        replyInput.content.trim(),
        replyInput.color,
        replyInput.is_calstick,
        replyInput.calstick_date,
        replyInput.calstick_status,
        replyInput.calstick_priority,
        replyInput.calstick_parent_id,
        replyInput.calstick_assignee_id,
      ]
    )

    // Get user data for response
    const userResult = await db.query(
      `SELECT username, email, full_name FROM users WHERE id = $1`,
      [user.id]
    )

    return new Response(
      JSON.stringify({
        reply: { ...replyResult.rows[0], user: userResult.rows[0] || null },
      }),
      { status: 200 }
    )
  } catch (error) {
    return handleApiError(error)
  }
}

// PUT /api/v2/sticks/[id]/replies - Update reply
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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
      return new Response(JSON.stringify({ error: 'Organization context required' }), { status: 403 })
    }

    const body = await request.json()
    const { replyId, content, color } = body

    if (!replyId) {
      return new Response(JSON.stringify({ error: 'Reply ID is required' }), { status: 400 })
    }

    if (!content?.trim()) {
      return new Response(JSON.stringify({ error: 'Content is required' }), { status: 400 })
    }

    // Check ownership
    const existingResult = await db.query(
      `SELECT user_id FROM paks_pad_stick_replies WHERE id = $1 AND org_id = $2`,
      [replyId, orgContext.orgId]
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

    // Update
    const updates = ['content = $1', 'updated_at = NOW()']
    const values = [content.trim()]
    let paramCount = 1

    if (color !== undefined) {
      paramCount++
      updates.push(`color = $${paramCount}`)
      values.push(color)
    }

    paramCount++
    values.push(replyId)
    paramCount++
    values.push(orgContext.orgId)

    const updateResult = await db.query(
      `UPDATE paks_pad_stick_replies
       SET ${updates.join(', ')}
       WHERE id = $${paramCount - 1} AND org_id = $${paramCount}
       RETURNING *`,
      values
    )

    // Get user data
    const userResult = await db.query(
      `SELECT username, email, full_name FROM users WHERE id = $1`,
      [user.id]
    )

    return new Response(
      JSON.stringify({
        reply: { ...updateResult.rows[0], user: userResult.rows[0] || null },
      }),
      { status: 200 }
    )
  } catch (error) {
    return handleApiError(error)
  }
}

// DELETE /api/v2/sticks/[id]/replies - Delete reply
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: stickId } = await params

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
    const { replyId } = body

    if (!replyId) {
      return new Response(JSON.stringify({ error: 'Reply ID is required' }), { status: 400 })
    }

    // Get reply
    const replyResult = await db.query(
      `SELECT user_id, stick_id FROM paks_pad_stick_replies WHERE id = $1 AND org_id = $2`,
      [replyId, orgContext.orgId]
    )

    if (replyResult.rows.length === 0) {
      return new Response(JSON.stringify({ error: 'Reply not found' }), { status: 404 })
    }

    const reply = replyResult.rows[0]

    // Check delete permission
    let canDelete = reply.user_id === user.id

    if (!canDelete) {
      // Check if user is pad owner
      const stickResult = await db.query(
        `SELECT s.pad_id, p.owner_id
         FROM paks_pad_sticks s
         LEFT JOIN paks_pads p ON s.pad_id = p.id
         WHERE s.id = $1 AND s.org_id = $2`,
        [stickId, orgContext.orgId]
      )

      if (stickResult.rows[0]?.owner_id === user.id) {
        canDelete = true
      }
    }

    if (!canDelete) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 })
    }

    await db.query(
      `DELETE FROM paks_pad_stick_replies WHERE id = $1 AND org_id = $2`,
      [replyId, orgContext.orgId]
    )

    return new Response(JSON.stringify({ success: true }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

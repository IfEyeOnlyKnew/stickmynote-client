// v2 Notes Replies API: production-quality, manage note replies
import { type NextRequest } from 'next/server'
import { db } from '@/lib/database/pg-client'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { getOrgContext } from '@/lib/auth/get-org-context'
import { handleApiError } from '@/lib/api/handle-api-error'

export const dynamic = 'force-dynamic'

const DEFAULT_REPLY_COLOR = '#fef3c7'

// GET /api/v2/notes/[id]/replies - Get replies
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: noteId } = await params

    // Get note to check access
    const noteResult = await db.query(
      `SELECT id, is_shared, user_id, org_id FROM personal_sticks WHERE id = $1`,
      [noteId]
    )

    if (noteResult.rows.length === 0) {
      return new Response(JSON.stringify({ replies: [] }), { status: 200 })
    }

    const note = noteResult.rows[0]

    // Private note check
    if (!note.is_shared) {
      const authResult = await getCachedAuthUser()
      if (authResult.rateLimited) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }),
          { status: 429, headers: { 'Retry-After': '30' } }
        )
      }

      if (!authResult.user || authResult.user.id !== note.user_id) {
        return new Response(JSON.stringify({ error: 'Access denied to private note' }), { status: 403 })
      }
    }

    // Get replies with user data (include parent_reply_id for threading)
    const repliesResult = await db.query(
      `SELECT r.id, r.content, r.color, r.created_at, r.updated_at, r.user_id, r.view_count, r.parent_reply_id,
              u.id as uid, u.username, u.full_name, u.avatar_url
       FROM personal_sticks_replies r
       LEFT JOIN users u ON r.user_id = u.id
       WHERE r.personal_stick_id = $1 AND r.org_id = $2
       ORDER BY r.created_at ASC`,
      [noteId, note.org_id]
    )

    const replies = repliesResult.rows.map((r: any) => ({
      id: r.id,
      content: r.content,
      color: r.color,
      created_at: r.created_at,
      updated_at: r.updated_at,
      user_id: r.user_id,
      view_count: r.view_count || 0,
      parent_reply_id: r.parent_reply_id || null,
      user: {
        id: r.uid,
        username: r.username,
        full_name: r.full_name,
        avatar_url: r.avatar_url,
      },
    }))

    return new Response(JSON.stringify({ replies }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

// POST /api/v2/notes/[id]/replies - Create reply
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: noteId } = await params

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
    const { content, color = DEFAULT_REPLY_COLOR } = body

    if (!content?.trim()) {
      return new Response(JSON.stringify({ error: 'Content is required' }), { status: 400 })
    }

    // Check note exists and access
    const noteResult = await db.query(
      `SELECT id, is_shared, user_id, org_id FROM personal_sticks WHERE id = $1`,
      [noteId]
    )

    if (noteResult.rows.length === 0) {
      return new Response(JSON.stringify({ error: 'Note not found' }), { status: 404 })
    }

    const note = noteResult.rows[0]

    // Check authorization
    if (!note.is_shared && note.user_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Cannot reply to private note' }), { status: 403 })
    }

    // Create reply
    const replyResult = await db.query(
      `INSERT INTO personal_sticks_replies (personal_stick_id, user_id, content, color, org_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [noteId, user.id, content.trim(), color, orgContext.orgId]
    )

    // Get user data
    const userResult = await db.query(
      `SELECT id, username, full_name, avatar_url FROM users WHERE id = $1`,
      [user.id]
    )

    return new Response(
      JSON.stringify({
        reply: {
          ...replyResult.rows[0],
          user: userResult.rows[0] || { id: user.id, username: user.email?.split('@')[0] || 'User' },
        },
      }),
      { status: 200 }
    )
  } catch (error) {
    return handleApiError(error)
  }
}

// PUT /api/v2/notes/[id]/replies - Update reply
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

    // Check ownership
    const existingResult = await db.query(
      `SELECT user_id, org_id FROM personal_sticks_replies WHERE id = $1`,
      [replyId]
    )

    if (existingResult.rows.length === 0) {
      return new Response(JSON.stringify({ error: 'Reply not found' }), { status: 404 })
    }

    if (existingResult.rows[0].user_id !== user.id) {
      return new Response(JSON.stringify({ error: "Cannot edit another user's reply" }), { status: 403 })
    }

    if (existingResult.rows[0].org_id !== orgContext.orgId) {
      return new Response(JSON.stringify({ error: 'Reply not in your organization' }), { status: 403 })
    }

    // Update
    const updates = ['updated_at = NOW()']
    const values: any[] = []
    let paramCount = 0

    if (content !== undefined) {
      paramCount++
      updates.push(`content = $${paramCount}`)
      values.push(content.trim())
    }
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
      `UPDATE personal_sticks_replies
       SET ${updates.join(', ')}
       WHERE id = $${paramCount - 1} AND org_id = $${paramCount}
       RETURNING *`,
      values
    )

    return new Response(JSON.stringify({ reply: updateResult.rows[0] }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

// DELETE /api/v2/notes/[id]/replies - Delete reply
export async function DELETE(
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
    const { replyId } = body

    if (!replyId) {
      return new Response(JSON.stringify({ error: 'Reply ID is required' }), { status: 400 })
    }

    // Get reply
    const replyResult = await db.query(
      `SELECT user_id, org_id, personal_stick_id FROM personal_sticks_replies WHERE id = $1`,
      [replyId]
    )

    if (replyResult.rows.length === 0) {
      return new Response(JSON.stringify({ error: 'Reply not found' }), { status: 404 })
    }

    const reply = replyResult.rows[0]

    if (reply.org_id !== orgContext.orgId) {
      return new Response(JSON.stringify({ error: 'Reply not in your organization' }), { status: 403 })
    }

    // Check delete permission
    if (reply.user_id !== user.id) {
      const noteResult = await db.query(
        `SELECT user_id, org_id FROM personal_sticks WHERE id = $1`,
        [reply.personal_stick_id]
      )

      if (!noteResult.rows[0] || noteResult.rows[0].user_id !== user.id || noteResult.rows[0].org_id !== orgContext.orgId) {
        return new Response(JSON.stringify({ error: "Cannot delete another user's reply" }), { status: 403 })
      }
    }

    await db.query(
      `DELETE FROM personal_sticks_replies WHERE id = $1 AND org_id = $2`,
      [replyId, orgContext.orgId]
    )

    return new Response(JSON.stringify({ success: true }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

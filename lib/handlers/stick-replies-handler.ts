// Shared handler logic for stick replies (v1 + v2 deduplication)
import { NextResponse } from "next/server"
import { query, querySingle } from "@/lib/database/pg-helpers"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"
import { getOrgContext } from "@/lib/auth/get-org-context"

export const DEFAULT_REPLY_COLOR = "#fef3c7"

export const REPLY_SELECT_FIELDS = `
  id,
  content,
  color,
  created_at,
  updated_at,
  user_id,
  parent_reply_id,
  is_calstick,
  calstick_date,
  calstick_completed,
  calstick_completed_at
`

export interface ReplyInput {
  content: string
  color?: string
  parent_reply_id?: string | null
  is_calstick?: boolean
  calstick_date?: string | null
  calstick_status?: string | null
  calstick_priority?: string | null
  calstick_parent_id?: string | null
  calstick_assignee_id?: string | null
}

export interface UpdateReplyInput {
  replyId: string
  content: string
  color?: string
}

export interface DeleteReplyInput {
  replyId: string
}

// Parse reply input with defaults
export function parseReplyInput(body: any): ReplyInput & { color: string } {
  return {
    content: body.content,
    color: body.color || DEFAULT_REPLY_COLOR,
    parent_reply_id: body.parent_reply_id ?? null,
    is_calstick: body.is_calstick ?? false,
    calstick_date: body.calstick_date ?? null,
    calstick_status: body.calstick_status ?? null,
    calstick_priority: body.calstick_priority ?? null,
    calstick_parent_id: body.calstick_parent_id ?? null,
    calstick_assignee_id: body.calstick_assignee_id ?? null,
  }
}

// Shared auth + org guard
async function getAuthAndOrg(): Promise<
  { error: NextResponse } | { user: { id: string; email?: string }; orgId: string }
> {
  const authResult = await getCachedAuthUser()
  if (authResult.rateLimited) {
    return {
      error: NextResponse.json(
        { error: "Rate limit exceeded. Please try again in a moment." },
        { status: 429, headers: { "Retry-After": "30" } },
      ),
    }
  }
  if (!authResult.user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }

  const orgContext = await getOrgContext()
  if (!orgContext) {
    return { error: NextResponse.json({ error: "Organization context required" }, { status: 403 }) }
  }

  return { user: authResult.user, orgId: orgContext.orgId }
}

// Check pad access (ownership or membership)
async function checkPadAccess(padId: string, userId: string, orgId: string): Promise<boolean> {
  const pad = await querySingle(
    `SELECT owner_id FROM paks_pads WHERE id = $1 AND org_id = $2`,
    [padId, orgId],
  )

  if (pad?.owner_id === userId) return true

  const member = await querySingle(
    `SELECT role FROM paks_pad_members WHERE pad_id = $1 AND user_id = $2`,
    [padId, userId],
  )

  return !!member
}

// GET - Fetch replies for a stick
export async function handleGetStickReplies(stickId: string): Promise<NextResponse> {
  try {
    const auth = await getAuthAndOrg()
    if ("error" in auth) return auth.error

    // Get stick
    const stick = await querySingle(
      `SELECT pad_id FROM paks_pad_sticks WHERE id = $1 AND org_id = $2`,
      [stickId, auth.orgId],
    )

    if (!stick) {
      return NextResponse.json({ error: "Stick not found" }, { status: 404 })
    }

    const hasAccess = await checkPadAccess(stick.pad_id, auth.user.id, auth.orgId)
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Get replies with user data
    const replies = await query(
      `SELECT r.id, r.content, r.color, r.created_at, r.updated_at, r.user_id,
              r.parent_reply_id, r.is_calstick, r.calstick_date, r.calstick_completed, r.calstick_completed_at,
              u.username, u.email, u.full_name
       FROM paks_pad_stick_replies r
       LEFT JOIN users u ON r.user_id = u.id
       WHERE r.stick_id = $1 AND r.org_id = $2
       ORDER BY r.created_at ASC`,
      [stickId, auth.orgId],
    )

    const repliesWithUsers = replies.map((r: any) => ({
      ...r,
      user: { id: r.user_id, username: r.username, email: r.email, full_name: r.full_name },
    }))

    return NextResponse.json({ replies: repliesWithUsers })
  } catch (error) {
    console.error("Error in stick replies GET:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST - Create a reply on a stick
export async function handleCreateStickReply(request: Request, stickId: string): Promise<NextResponse> {
  try {
    const auth = await getAuthAndOrg()
    if ("error" in auth) return auth.error

    const body = await request.json()
    const replyInput = parseReplyInput(body)

    if (!replyInput.content?.trim()) {
      return NextResponse.json({ error: "Content is required" }, { status: 400 })
    }

    // Get stick
    const stick = await querySingle(
      `SELECT pad_id FROM paks_pad_sticks WHERE id = $1 AND org_id = $2`,
      [stickId, auth.orgId],
    )

    if (!stick) {
      return NextResponse.json({ error: "Stick not found" }, { status: 404 })
    }

    const hasAccess = await checkPadAccess(stick.pad_id, auth.user.id, auth.orgId)
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Create reply
    const reply = await querySingle(
      `INSERT INTO paks_pad_stick_replies
       (stick_id, user_id, org_id, content, color, parent_reply_id, is_calstick, calstick_date,
        calstick_status, calstick_priority, calstick_parent_id, calstick_assignee_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        stickId,
        auth.user.id,
        auth.orgId,
        replyInput.content.trim(),
        replyInput.color,
        replyInput.parent_reply_id,
        replyInput.is_calstick,
        replyInput.calstick_date,
        replyInput.calstick_status,
        replyInput.calstick_priority,
        replyInput.calstick_parent_id,
        replyInput.calstick_assignee_id,
      ],
    )

    // Get user data for response
    const userData = await querySingle(
      `SELECT username, email, full_name FROM users WHERE id = $1`,
      [auth.user.id],
    )

    return NextResponse.json({
      reply: { ...reply, user: userData || null },
    })
  } catch (error) {
    console.error("Error in stick replies POST:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PUT - Update a reply
export async function handleUpdateStickReply(request: Request): Promise<NextResponse> {
  try {
    const auth = await getAuthAndOrg()
    if ("error" in auth) return auth.error

    const body = await request.json()
    const { replyId, content, color } = body

    if (!replyId) {
      return NextResponse.json({ error: "Reply ID is required" }, { status: 400 })
    }

    if (!content?.trim()) {
      return NextResponse.json({ error: "Content is required" }, { status: 400 })
    }

    // Check ownership
    const existing = await querySingle(
      `SELECT user_id FROM paks_pad_stick_replies WHERE id = $1 AND org_id = $2`,
      [replyId, auth.orgId],
    )

    if (!existing) {
      return NextResponse.json({ error: "Reply not found" }, { status: 404 })
    }

    if (existing.user_id !== auth.user.id) {
      return NextResponse.json({ error: "You can only edit your own replies" }, { status: 403 })
    }

    // Build update query
    const updates = ["content = $1", "updated_at = NOW()"]
    const values: any[] = [content.trim()]
    let paramCount = 1

    if (color !== undefined) {
      paramCount++
      updates.push(`color = $${paramCount}`)
      values.push(color)
    }

    paramCount++
    values.push(replyId)
    paramCount++
    values.push(auth.orgId)

    const reply = await querySingle(
      `UPDATE paks_pad_stick_replies
       SET ${updates.join(", ")}
       WHERE id = $${paramCount - 1} AND org_id = $${paramCount}
       RETURNING *`,
      values,
    )

    // Get user data for response
    const userData = await querySingle(
      `SELECT username, email, full_name FROM users WHERE id = $1`,
      [auth.user.id],
    )

    return NextResponse.json({
      reply: { ...reply, user: userData || null },
    })
  } catch (error) {
    console.error("Error in stick replies PUT:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE - Delete a reply
export async function handleDeleteStickReply(request: Request, stickId: string): Promise<NextResponse> {
  try {
    const auth = await getAuthAndOrg()
    if ("error" in auth) return auth.error

    const body = await request.json()
    const { replyId } = body

    if (!replyId) {
      return NextResponse.json({ error: "Reply ID is required" }, { status: 400 })
    }

    // Get reply
    const reply = await querySingle(
      `SELECT user_id, stick_id FROM paks_pad_stick_replies WHERE id = $1 AND org_id = $2`,
      [replyId, auth.orgId],
    )

    if (!reply) {
      return NextResponse.json({ error: "Reply not found" }, { status: 404 })
    }

    // Check delete permission
    let canDelete = reply.user_id === auth.user.id

    if (!canDelete) {
      // Check if user is pad owner
      const stickWithPad = await querySingle(
        `SELECT s.pad_id, p.owner_id
         FROM paks_pad_sticks s
         LEFT JOIN paks_pads p ON s.pad_id = p.id
         WHERE s.id = $1 AND s.org_id = $2`,
        [stickId, auth.orgId],
      )

      if (stickWithPad?.owner_id === auth.user.id) {
        canDelete = true
      }
    }

    if (!canDelete) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    await query(
      `DELETE FROM paks_pad_stick_replies WHERE id = $1 AND org_id = $2`,
      [replyId, auth.orgId],
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error in stick replies DELETE:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

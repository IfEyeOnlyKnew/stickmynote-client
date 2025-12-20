// v2 Social Sticks Reply Promote API: production-quality, promote reply to CalStick
import { type NextRequest } from 'next/server'
import { db } from '@/lib/database/pg-client'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { getOrgContext } from '@/lib/auth/get-org-context'
import { handleApiError } from '@/lib/api/handle-api-error'

export const dynamic = 'force-dynamic'

// POST /api/v2/social-sticks/[stickId]/replies/[replyId]/promote - Promote reply to CalStick
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ stickId: string; replyId: string }> }
) {
  try {
    const { stickId, replyId } = await params

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
    const { priority, dueDate, assigneeId } = body

    // Get reply
    const replyResult = await db.query(
      `SELECT id, content, color, social_stick_id, user_id, org_id, calstick_id
       FROM social_stick_replies
       WHERE id = $1 AND social_stick_id = $2`,
      [replyId, stickId]
    )

    if (replyResult.rows.length === 0) {
      return new Response(JSON.stringify({ error: 'Reply not found' }), { status: 404 })
    }

    const reply = replyResult.rows[0]

    if (reply.calstick_id) {
      return new Response(
        JSON.stringify({ error: 'Already promoted', calstickId: reply.calstick_id }),
        { status: 400 }
      )
    }

    // Get parent social stick
    const stickResult = await db.query(
      `SELECT id, topic, social_pad_id FROM social_sticks WHERE id = $1`,
      [stickId]
    )

    if (stickResult.rows.length === 0) {
      return new Response(JSON.stringify({ error: 'Parent stick not found' }), { status: 404 })
    }

    const socialStick = stickResult.rows[0]

    // Find or create parent stick
    const parentResult = await db.query(
      `SELECT id, pad_id FROM paks_pad_sticks WHERE pad_id = $1 LIMIT 1`,
      [socialStick.social_pad_id]
    )

    let stickIdForCalstick = parentResult.rows[0]?.id

    if (!stickIdForCalstick) {
      const newStickResult = await db.query(
        `INSERT INTO paks_pad_sticks (topic, content, color, user_id, org_id, pad_id)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [
          `Social: ${socialStick.topic || 'Untitled'}`,
          reply.content,
          reply.color,
          user.id,
          orgContext.orgId,
          socialStick.social_pad_id,
        ]
      )
      stickIdForCalstick = newStickResult.rows[0]?.id
    }

    const calstickContent = `[Promoted from Social Hub Reply]\nTopic: ${socialStick.topic || 'Untitled'}\n\nReply Content:\n${reply.content}`

    // Create CalStick
    const calstickResult = await db.query(
      `INSERT INTO paks_pad_stick_replies
       (content, color, user_id, org_id, is_calstick, calstick_status, calstick_priority,
        calstick_completed, stick_id, social_stick_id, social_stick_reply_id, calstick_date, calstick_assignee_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING id`,
      [
        calstickContent,
        reply.color,
        user.id,
        orgContext.orgId,
        true,
        'in-progress',
        priority || 'medium',
        false,
        stickIdForCalstick,
        stickId,
        replyId,
        dueDate || null,
        assigneeId || null,
      ]
    )

    const calstickId = calstickResult.rows[0].id

    // Update reply with CalStick reference
    await db.query(
      `UPDATE social_stick_replies
       SET calstick_id = $1, promoted_at = NOW(), promoted_by = $2
       WHERE id = $3`,
      [calstickId, user.id, replyId]
    )

    return new Response(
      JSON.stringify({ success: true, calstickId, replyId, stickId }),
      { status: 200 }
    )
  } catch (error) {
    return handleApiError(error)
  }
}

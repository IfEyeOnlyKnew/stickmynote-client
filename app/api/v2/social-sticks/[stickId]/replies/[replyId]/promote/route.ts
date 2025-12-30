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
    const { priority, dueDate, assigneeId, title } = body

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

    // Get the social pad name to use for the paks_pad
    const socialPadResult = await db.query(
      `SELECT id, name FROM social_pads WHERE id = $1`,
      [socialStick.social_pad_id]
    )

    if (socialPadResult.rows.length === 0) {
      return new Response(JSON.stringify({ error: 'Social pad not found' }), { status: 404 })
    }

    const socialPad = socialPadResult.rows[0]
    const padName = socialPad.name || 'CalSticks'

    // Find or create a paks_pad with the same name as the social pad
    let paksPadId: string | undefined

    const existingPaksPadResult = await db.query(
      `SELECT id FROM paks_pads WHERE owner_id = $1 AND org_id = $2 AND name = $3`,
      [user.id, orgContext.orgId, padName]
    )

    if (existingPaksPadResult.rows.length > 0) {
      paksPadId = existingPaksPadResult.rows[0].id
    } else {
      // Create a paks_pad with the social pad's name
      const newPaksPadResult = await db.query(
        `INSERT INTO paks_pads (name, owner_id, org_id)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [padName, user.id, orgContext.orgId]
      )
      paksPadId = newPaksPadResult.rows[0]?.id
    }

    if (!paksPadId) {
      return new Response(JSON.stringify({ error: 'Could not find or create CalStick pad' }), { status: 500 })
    }

    // Find or create parent stick in the paks_pad
    const parentResult = await db.query(
      `SELECT id FROM paks_pad_sticks WHERE pad_id = $1 AND user_id = $2 LIMIT 1`,
      [paksPadId, user.id]
    )

    let stickIdForCalstick = parentResult.rows[0]?.id

    if (!stickIdForCalstick) {
      const newStickResult = await db.query(
        `INSERT INTO paks_pad_sticks (topic, content, color, user_id, org_id, pad_id)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [
          socialStick.topic || 'Untitled',
          reply.content,
          reply.color,
          user.id,
          orgContext.orgId,
          paksPadId,
        ]
      )
      stickIdForCalstick = newStickResult.rows[0]?.id
    }

    // Use the provided title as the CalStick content, or fall back to reply content
    const calstickContent = title || reply.content

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

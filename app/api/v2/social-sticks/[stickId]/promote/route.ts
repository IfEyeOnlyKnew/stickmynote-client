// v2 Social Sticks Promote API: production-quality, promote stick to CalStick
import { type NextRequest } from 'next/server'
import { db } from '@/lib/database/pg-client'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { getOrgContext } from '@/lib/auth/get-org-context'
import { handleApiError } from '@/lib/api/handle-api-error'

export const dynamic = 'force-dynamic'

// POST /api/v2/social-sticks/[stickId]/promote - Promote to CalStick
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

    const body = await request.json()
    const { priority, dueDate, assigneeId } = body

    // Get stick
    const stickResult = await db.query(
      `SELECT id, topic, content, color, social_pad_id, user_id, org_id, calstick_id
       FROM social_sticks
       WHERE id = $1`,
      [stickId]
    )

    if (stickResult.rows.length === 0) {
      return new Response(JSON.stringify({ error: 'Stick not found' }), { status: 404 })
    }

    const stick = stickResult.rows[0]

    if (stick.calstick_id) {
      return new Response(
        JSON.stringify({ error: 'Already promoted', calstickId: stick.calstick_id }),
        { status: 400 }
      )
    }

    // Find or create parent stick
    const parentResult = await db.query(
      `SELECT id, pad_id FROM paks_pad_sticks WHERE pad_id = $1 LIMIT 1`,
      [stick.social_pad_id]
    )

    let stickIdForCalstick = parentResult.rows[0]?.id

    if (!stickIdForCalstick) {
      const newStickResult = await db.query(
        `INSERT INTO paks_pad_sticks (topic, content, color, user_id, org_id, pad_id)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [stick.topic, stick.content, stick.color, user.id, orgContext.orgId, stick.social_pad_id]
      )
      stickIdForCalstick = newStickResult.rows[0]?.id
    }

    // Create CalStick
    const calstickResult = await db.query(
      `INSERT INTO paks_pad_stick_replies
       (content, color, user_id, org_id, is_calstick, calstick_status, calstick_priority,
        calstick_completed, stick_id, social_stick_id, calstick_date, calstick_assignee_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING id`,
      [
        `[Promoted from Social Hub] ${stick.topic || 'Untitled'}\n\n${stick.content}`,
        stick.color,
        user.id,
        orgContext.orgId,
        true,
        'in-progress',
        priority || 'medium',
        false,
        stickIdForCalstick,
        stickId,
        dueDate || null,
        assigneeId || null,
      ]
    )

    const calstickId = calstickResult.rows[0].id

    // Update stick with CalStick reference
    await db.query(
      `UPDATE social_sticks
       SET calstick_id = $1, workflow_status = 'in_progress',
           promoted_at = NOW(), promoted_by = $2, workflow_updated_at = NOW()
       WHERE id = $3`,
      [calstickId, user.id, stickId]
    )

    return new Response(
      JSON.stringify({ success: true, calstickId, stickId }),
      { status: 200 }
    )
  } catch (error) {
    return handleApiError(error)
  }
}

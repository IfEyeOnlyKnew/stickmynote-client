// v2 Social Pads Member Permissions API: production-quality, update member permissions
import { type NextRequest } from 'next/server'
import { db } from '@/lib/database/pg-client'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { handleApiError } from '@/lib/api/handle-api-error'

export const dynamic = 'force-dynamic'

// PATCH /api/v2/inference-pads/[padId]/members/[memberId]/permissions - Update permissions
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ padId: string; memberId: string }> }
) {
  try {
    const { padId, memberId } = await params

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

    // Check if current user is owner or admin
    const membershipResult = await db.query(
      `SELECT admin_level FROM social_pad_members
       WHERE social_pad_id = $1 AND user_id = $2 AND accepted = true`,
      [padId, user.id]
    )

    const padResult = await db.query(
      `SELECT owner_id FROM social_pads WHERE id = $1`,
      [padId]
    )

    const isOwner = padResult.rows[0]?.owner_id === user.id
    const isAdmin = membershipResult.rows[0]?.admin_level === 'admin'

    if (!isOwner && !isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Only owners and admins can change permissions' }),
        { status: 403 }
      )
    }

    const body = await request.json()

    // Validate permission fields
    const validPermissions: Record<string, boolean | undefined> = {
      can_create_sticks: body.can_create_sticks,
      can_reply: body.can_reply,
      can_edit_others_sticks: body.can_edit_others_sticks,
      can_delete_others_sticks: body.can_delete_others_sticks,
      can_invite_members: body.can_invite_members,
      can_pin_sticks: body.can_pin_sticks,
    }

    // Build update query
    const updates: string[] = []
    const values: any[] = []
    let paramIndex = 1

    for (const [key, value] of Object.entries(validPermissions)) {
      if (value !== undefined) {
        updates.push(`${key} = $${paramIndex}`)
        values.push(value)
        paramIndex++
      }
    }

    if (updates.length === 0) {
      return new Response(JSON.stringify({ error: 'No valid permissions to update' }), { status: 400 })
    }

    values.push(memberId, padId)

    const updateResult = await db.query(
      `UPDATE social_pad_members
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex} AND social_pad_id = $${paramIndex + 1}
       RETURNING *`,
      values
    )

    return new Response(JSON.stringify({ member: updateResult.rows[0] }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

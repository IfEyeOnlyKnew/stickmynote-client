// v2 Social Pads Member [memberId] API: production-quality, manage individual member
import { type NextRequest } from 'next/server'
import { db } from '@/lib/database/pg-client'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { handleApiError } from '@/lib/api/handle-api-error'

export const dynamic = 'force-dynamic'

// PATCH /api/v2/social-pads/[padId]/members/[memberId] - Update member admin level
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

    // Check if user is owner of the pad
    const membershipResult = await db.query(
      `SELECT admin_level FROM social_pad_members
       WHERE social_pad_id = $1 AND user_id = $2`,
      [padId, user.id]
    )

    if (membershipResult.rows.length === 0 || membershipResult.rows[0].admin_level !== 'owner') {
      return new Response(
        JSON.stringify({ error: 'Only owners can modify admin permissions' }),
        { status: 403 }
      )
    }

    const body = await request.json()
    const { admin_level } = body

    if (!['owner', 'admin', 'member'].includes(admin_level)) {
      return new Response(JSON.stringify({ error: 'Invalid admin level' }), { status: 400 })
    }

    // Prevent changing owner's admin level
    const targetResult = await db.query(
      `SELECT admin_level FROM social_pad_members WHERE id = $1`,
      [memberId]
    )

    if (targetResult.rows[0]?.admin_level === 'owner' && admin_level !== 'owner') {
      return new Response(
        JSON.stringify({ error: "Cannot change owner's admin level" }),
        { status: 400 }
      )
    }

    const updateResult = await db.query(
      `UPDATE social_pad_members
       SET admin_level = $1
       WHERE id = $2 AND social_pad_id = $3
       RETURNING *`,
      [admin_level, memberId, padId]
    )

    return new Response(JSON.stringify({ member: updateResult.rows[0] }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

// DELETE /api/v2/social-pads/[padId]/members/[memberId] - Remove member
export async function DELETE(
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

    // Check if user is owner of the pad
    const membershipResult = await db.query(
      `SELECT admin_level FROM social_pad_members
       WHERE social_pad_id = $1 AND user_id = $2`,
      [padId, user.id]
    )

    if (membershipResult.rows.length === 0 || membershipResult.rows[0].admin_level !== 'owner') {
      return new Response(
        JSON.stringify({ error: 'Only owners can remove members' }),
        { status: 403 }
      )
    }

    // Prevent removing owner
    const targetResult = await db.query(
      `SELECT admin_level FROM social_pad_members WHERE id = $1`,
      [memberId]
    )

    if (targetResult.rows[0]?.admin_level === 'owner') {
      return new Response(JSON.stringify({ error: 'Cannot remove owner' }), { status: 400 })
    }

    await db.query(
      `DELETE FROM social_pad_members WHERE id = $1 AND social_pad_id = $2`,
      [memberId, padId]
    )

    return new Response(
      JSON.stringify({ message: 'Member removed successfully' }),
      { status: 200 }
    )
  } catch (error) {
    return handleApiError(error)
  }
}

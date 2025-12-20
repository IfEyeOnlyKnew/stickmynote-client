// v2 Social Sticks Member [memberId] API: production-quality, manage individual member
import { type NextRequest } from 'next/server'
import { db } from '@/lib/database/pg-client'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { handleApiError } from '@/lib/api/handle-api-error'

export const dynamic = 'force-dynamic'

// DELETE /api/v2/social-sticks/[stickId]/members/[memberId] - Remove member
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ stickId: string; memberId: string }> }
) {
  try {
    const { stickId, memberId } = await params

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

    // Get stick with pad info
    const stickResult = await db.query(
      `SELECT ss.social_pad_id, sp.owner_id as pad_owner_id
       FROM social_sticks ss
       LEFT JOIN social_pads sp ON ss.social_pad_id = sp.id
       WHERE ss.id = $1`,
      [stickId]
    )

    if (stickResult.rows.length === 0) {
      return new Response(JSON.stringify({ error: 'Stick not found' }), { status: 404 })
    }

    const stick = stickResult.rows[0]

    // Check permission
    const isOwner = stick.pad_owner_id === user.id
    if (!isOwner) {
      const memberResult = await db.query(
        `SELECT role FROM social_pad_members
         WHERE social_pad_id = $1 AND user_id = $2`,
        [stick.social_pad_id, user.id]
      )

      if (memberResult.rows[0]?.role !== 'admin') {
        return new Response(
          JSON.stringify({ error: 'Only pad owners and admins can manage stick members' }),
          { status: 403 }
        )
      }
    }

    // Delete member
    await db.query(
      `DELETE FROM social_stick_members WHERE id = $1 AND social_stick_id = $2`,
      [memberId, stickId]
    )

    return new Response(JSON.stringify({ message: 'Member removed successfully' }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

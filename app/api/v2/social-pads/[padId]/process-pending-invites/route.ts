// v2 Social Pads Process Pending Invites API: production-quality, process invites
import { type NextRequest } from 'next/server'
import { db } from '@/lib/database/pg-client'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { handleApiError } from '@/lib/api/handle-api-error'

export const dynamic = 'force-dynamic'

// POST /api/v2/social-pads/[padId]/process-pending-invites - Process pending invites
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ padId: string }> }
) {
  try {
    const { padId } = await params

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

    // Check for pending invites for this user's email
    const invitesResult = await db.query(
      `SELECT * FROM social_pad_pending_invites
       WHERE email = $1 AND social_pad_id = $2`,
      [user.email, padId]
    )

    if (invitesResult.rows.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No pending invites found' }),
        { status: 200 }
      )
    }

    const results: { invite_id: string; status: string; error?: string }[] = []

    for (const invite of invitesResult.rows) {
      // Check if already a member
      const existingResult = await db.query(
        `SELECT id FROM social_pad_members
         WHERE social_pad_id = $1 AND user_id = $2`,
        [padId, user.id]
      )

      if (existingResult.rows.length > 0) {
        // Delete the pending invite
        await db.query(
          `DELETE FROM social_pad_pending_invites WHERE id = $1`,
          [invite.id]
        )
        results.push({ invite_id: invite.id, status: 'already_member' })
        continue
      }

      // Create membership
      try {
        await db.query(
          `INSERT INTO social_pad_members
           (social_pad_id, user_id, role, accepted, invited_by)
           VALUES ($1, $2, $3, $4, $5)`,
          [padId, user.id, invite.role, true, invite.invited_by]
        )

        // Delete the processed invite
        await db.query(
          `DELETE FROM social_pad_pending_invites WHERE id = $1`,
          [invite.id]
        )

        results.push({ invite_id: invite.id, status: 'processed' })
      } catch (memberError: any) {
        results.push({
          invite_id: invite.id,
          status: 'error',
          error: memberError.message,
        })
      }
    }

    return new Response(
      JSON.stringify({ message: 'Pending invites processed', results }),
      { status: 200 }
    )
  } catch (error) {
    return handleApiError(error)
  }
}

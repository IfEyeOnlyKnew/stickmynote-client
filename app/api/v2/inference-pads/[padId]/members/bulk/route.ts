// v2 Social Pads Members Bulk API: production-quality, bulk invite members
import { type NextRequest } from 'next/server'
import { db } from '@/lib/database/pg-client'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { handleApiError } from '@/lib/api/handle-api-error'

export const dynamic = 'force-dynamic'

type ProcessResult = { status: 'added' | 'invited' | 'skipped'; error?: string }

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

// POST /api/v2/inference-pads/[padId]/members/bulk - Bulk add/invite members
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

    const body = await request.json()
    const { emails, role } = body

    // Validate input
    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return new Response(JSON.stringify({ error: 'Emails array is required' }), { status: 400 })
    }
    if (!role || !['admin', 'member', 'editor', 'viewer'].includes(role)) {
      return new Response(
        JSON.stringify({ error: 'Valid role is required (admin, editor, viewer, or member)' }),
        { status: 400 }
      )
    }

    // Check permissions
    const padResult = await db.query(
      `SELECT owner_id, name FROM social_pads WHERE id = $1`,
      [padId]
    )

    if (padResult.rows.length === 0) {
      return new Response(JSON.stringify({ error: 'Pad not found' }), { status: 404 })
    }

    const pad = padResult.rows[0]

    const membershipResult = await db.query(
      `SELECT role FROM social_pad_members
       WHERE social_pad_id = $1 AND user_id = $2 AND accepted = true`,
      [padId, user.id]
    )

    const canInvite = pad.owner_id === user.id || membershipResult.rows[0]?.role === 'admin'

    if (!canInvite) {
      return new Response(JSON.stringify({ error: 'Permission denied' }), { status: 403 })
    }

    // Process each email
    const results: ProcessResult[] = await Promise.all(
      emails.map(async (email: string): Promise<ProcessResult> => {
        try {
          // Check if user exists
          const userResult = await db.query(
            `SELECT id FROM users WHERE email = $1`,
            [email]
          )

          if (userResult.rows.length > 0) {
            const invitedUserId = userResult.rows[0].id

            // Check if already a member
            const existingResult = await db.query(
              `SELECT id FROM social_pad_members
               WHERE social_pad_id = $1 AND user_id = $2`,
              [padId, invitedUserId]
            )

            if (existingResult.rows.length > 0) {
              return { status: 'skipped' }
            }

            // Add as member
            await db.query(
              `INSERT INTO social_pad_members
               (social_pad_id, user_id, role, invited_by, accepted)
               VALUES ($1, $2, $3, $4, $5)`,
              [padId, invitedUserId, role === 'member' ? 'viewer' : role, user.id, true]
            )

            return { status: 'added' }
          } else {
            // Check for existing invite
            const inviteResult = await db.query(
              `SELECT id FROM social_pad_pending_invites
               WHERE social_pad_id = $1 AND email = $2`,
              [padId, email]
            )

            if (inviteResult.rows.length > 0) {
              return { status: 'skipped' }
            }

            // Create pending invite
            await db.query(
              `INSERT INTO social_pad_pending_invites
               (social_pad_id, email, role, invited_by)
               VALUES ($1, $2, $3, $4)`,
              [padId, email, role === 'member' ? 'viewer' : role, user.id]
            )

            return { status: 'invited' }
          }
        } catch (error) {
          console.error(`Error processing ${email}:`, error)
          return { status: 'skipped', error: `Error processing ${email}` }
        }
      })
    )

    const added = results.filter((r) => r.status === 'added').length
    const invited = results.filter((r) => r.status === 'invited').length
    const skipped = results.filter((r) => r.status === 'skipped').length
    const errors = results.filter((r) => r.error).map((r) => r.error!)

    return new Response(
      JSON.stringify({
        added,
        invited,
        skipped,
        errors: errors.length > 0 ? errors : undefined,
        message: `Added ${added} existing user${added === 1 ? '' : 's'}, invited ${invited} new user${invited === 1 ? '' : 's'}` + (skipped > 0 ? `, ${skipped} skipped` : ''),
      }),
      { status: 200 }
    )
  } catch (error) {
    return handleApiError(error)
  }
}

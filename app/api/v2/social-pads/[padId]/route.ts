// v2 Social Pads [padId] API: production-quality, get and update social pad
import { type NextRequest } from 'next/server'
import { db } from '@/lib/database/pg-client'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { getOrgContext } from '@/lib/auth/get-org-context'
import { handleApiError } from '@/lib/api/handle-api-error'
import { isUnderLegalHold } from '@/lib/legal-hold/check-hold'

export const dynamic = 'force-dynamic'

// GET /api/v2/social-pads/[padId] - Get social pad with sticks
export async function GET(
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

    const user = authResult.user
    const orgContext = user ? await getOrgContext() : null

    // Get pad with member count
    let padQuery = `SELECT sp.*,
                    (SELECT COUNT(*) FROM social_pad_members WHERE social_pad_id = sp.id) as member_count
                    FROM social_pads sp WHERE sp.id = $1`
    const padParams: any[] = [padId]

    if (orgContext) {
      padQuery += ` AND sp.org_id = $2`
      padParams.push(orgContext.orgId)
    }

    const padResult = await db.query(padQuery, padParams)
    const pad = padResult.rows[0]

    if (!pad) {
      return new Response(JSON.stringify({ error: 'Pad not found' }), { status: 404 })
    }

    // Get owner info
    const ownerResult = await db.query(
      `SELECT email, full_name FROM users WHERE id = $1`,
      [pad.owner_id]
    )
    const owner = ownerResult.rows[0] || null

    // Check access for private pads
    if (!pad.is_public) {
      if (!user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
      }

      const memberResult = await db.query(
        `SELECT * FROM social_pad_members
         WHERE social_pad_id = $1 AND user_id = $2 AND accepted = true`,
        [padId, user.id]
      )

      if (pad.owner_id !== user.id && memberResult.rows.length === 0) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 })
      }
    }

    // Get sticks with reply counts
    let sticksQuery = `SELECT ss.*,
                       (SELECT COUNT(*) FROM social_stick_replies WHERE social_stick_id = ss.id) as reply_count
                       FROM social_sticks ss WHERE ss.social_pad_id = $1`
    const sticksParams: any[] = [padId]

    if (orgContext) {
      sticksQuery += ` AND ss.org_id = $2`
      sticksParams.push(orgContext.orgId)
    }

    sticksQuery += ` ORDER BY ss.created_at DESC`

    const sticksResult = await db.query(sticksQuery, sticksParams)

    // Get user info for each stick
    const sticksWithUsers = await Promise.all(
      sticksResult.rows.map(async (stick: any) => {
        const userResult = await db.query(
          `SELECT email, full_name FROM users WHERE id = $1`,
          [stick.user_id]
        )
        return {
          ...stick,
          user: userResult.rows[0] || null,
        }
      })
    )

    return new Response(
      JSON.stringify({
        pad: { ...pad, owner },
        sticks: sticksWithUsers,
      }),
      { status: 200 }
    )
  } catch (error) {
    return handleApiError(error)
  }
}

// PATCH /api/v2/social-pads/[padId] - Update social pad
export async function PATCH(
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

    const orgContext = await getOrgContext()
    if (!orgContext) {
      return new Response(JSON.stringify({ error: 'Organization context required' }), { status: 401 })
    }

    // Check ownership
    const padResult = await db.query(
      `SELECT owner_id FROM social_pads WHERE id = $1 AND org_id = $2`,
      [padId, orgContext.orgId]
    )

    if (padResult.rows.length === 0 || padResult.rows[0].owner_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 403 })
    }

    const body = await request.json()
    const { name, description, is_public } = body

    const updateResult = await db.query(
      `UPDATE social_pads
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           is_public = COALESCE($3, is_public),
           updated_at = NOW()
       WHERE id = $4 AND org_id = $5
       RETURNING *`,
      [name, description, is_public, padId, orgContext.orgId]
    )

    return new Response(JSON.stringify({ pad: updateResult.rows[0] }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

// DELETE /api/v2/social-pads/[padId] - Delete social pad
export async function DELETE(
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

    const orgContext = await getOrgContext()
    if (!orgContext) {
      return new Response(JSON.stringify({ error: 'Organization context required' }), { status: 401 })
    }

    // Check ownership
    const padResult = await db.query(
      `SELECT owner_id FROM social_pads WHERE id = $1 AND org_id = $2`,
      [padId, orgContext.orgId]
    )

    if (padResult.rows.length === 0 || padResult.rows[0].owner_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 403 })
    }

    if (await isUnderLegalHold(user.id, orgContext.orgId)) {
      return new Response(JSON.stringify({ error: 'Content cannot be deleted: active legal hold' }), { status: 403 })
    }

    // Delete pad (cascade should handle members, sticks, etc.)
    await db.query(`DELETE FROM social_pads WHERE id = $1`, [padId])

    return new Response(JSON.stringify({ success: true }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

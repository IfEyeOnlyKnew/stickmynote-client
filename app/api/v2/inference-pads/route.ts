// v2 Social Pads API: production-quality, list and create social pads
import { type NextRequest } from 'next/server'
import { db } from '@/lib/database/pg-client'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { getOrgContext } from '@/lib/auth/get-org-context'
import { handleApiError } from '@/lib/api/handle-api-error'

export const dynamic = 'force-dynamic'

const ADMIN_EMAILS = ['chrisdoran63@outlook.com']

// GET /api/v2/inference-pads - List social pads
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const isPublic = searchParams.get('public') === 'true'
    const isAdmin = searchParams.get('admin') === 'true'
    const isPrivate = searchParams.get('private') === 'true'

    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }),
        { status: 429, headers: { 'Retry-After': '30' } }
      )
    }

    const user = authResult.user
    const orgContext = user ? await getOrgContext() : null

    // Public pads - no auth required
    if (isPublic) {
      const result = await db.query(
        `SELECT * FROM social_pads WHERE is_public = true ORDER BY created_at DESC`
      )
      return new Response(JSON.stringify({ pads: result.rows }), { status: 200 })
    }

    // All other queries require auth
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }

    // Admin view - only for admin users
    if (isAdmin) {
      const isUserAdmin = user.email && ADMIN_EMAILS.includes(user.email)
      if (!isUserAdmin) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 })
      }

      const result = await db.query(`SELECT * FROM social_pads ORDER BY created_at DESC`)
      return new Response(JSON.stringify({ pads: result.rows }), { status: 200 })
    }

    if (!orgContext) {
      return new Response(JSON.stringify({ error: 'No organization context' }), { status: 403 })
    }

    // Private pads only
    if (isPrivate) {
      const ownedResult = await db.query(
        `SELECT * FROM social_pads
         WHERE owner_id = $1 AND org_id = $2 AND is_public = false
         ORDER BY created_at DESC`,
        [user.id, orgContext.orgId]
      )

      const memberResult = await db.query(
        `SELECT sp.* FROM social_pads sp
         INNER JOIN social_pad_members spm ON sp.id = spm.social_pad_id
         WHERE spm.user_id = $1 AND spm.accepted = true
           AND sp.org_id = $2 AND sp.is_public = false
           AND sp.owner_id != $1
         ORDER BY sp.created_at DESC`,
        [user.id, orgContext.orgId]
      )

      const allPrivatePads = [...ownedResult.rows, ...memberResult.rows]
      return new Response(JSON.stringify({ pads: allPrivatePads }), { status: 200 })
    }

    // Default: all user's pads (owned + member)
    const ownedResult = await db.query(
      `SELECT * FROM social_pads
       WHERE owner_id = $1 AND org_id = $2
       ORDER BY created_at DESC`,
      [user.id, orgContext.orgId]
    )

    const memberResult = await db.query(
      `SELECT sp.* FROM social_pads sp
       INNER JOIN social_pad_members spm ON sp.id = spm.social_pad_id
       WHERE spm.user_id = $1 AND spm.accepted = true
         AND sp.org_id = $2 AND sp.owner_id != $1
       ORDER BY sp.created_at DESC`,
      [user.id, orgContext.orgId]
    )

    const allPads = [...ownedResult.rows, ...memberResult.rows]
    const uniquePads = Array.from(new Map(allPads.map((pad) => [pad.id, pad])).values())

    return new Response(JSON.stringify({ pads: uniquePads }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

// POST /api/v2/inference-pads - Create new social pad
export async function POST(request: NextRequest) {
  try {
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
      return new Response(JSON.stringify({ error: 'No organization context' }), { status: 403 })
    }

    const body = await request.json()
    const { name, description, is_public, category_id, hub_type, hub_email, access_mode, home_code } = body

    if (!name?.trim()) {
      return new Response(JSON.stringify({ error: 'Pad name is required' }), { status: 400 })
    }

    // Start transaction
    await db.query('BEGIN')

    try {
      // Insert pad
      const padResult = await db.query(
        `INSERT INTO social_pads
         (name, description, owner_id, org_id, is_public, category_id, hub_type, hub_email, access_mode, home_code)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [
          name.trim(),
          description?.trim() || null,
          user.id,
          orgContext.orgId,
          is_public || false,
          category_id || null,
          hub_type || null,
          hub_email || null,
          access_mode || null,
          home_code?.trim() || null,
        ]
      )

      const pad = padResult.rows[0]

      if (!pad) {
        throw new Error('Failed to create pad')
      }

      // Add owner as member
      await db.query(
        `INSERT INTO social_pad_members
         (social_pad_id, user_id, org_id, role, accepted, invited_by, admin_level)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [pad.id, user.id, orgContext.orgId, 'editor', true, user.id, 'owner']
      )

      await db.query('COMMIT')

      return new Response(JSON.stringify({ pad }), { status: 200 })
    } catch (error) {
      await db.query('ROLLBACK')
      throw error
    }
  } catch (error) {
    return handleApiError(error)
  }
}

// v2 Social Sticks API: production-quality, list and create social sticks
import { type NextRequest } from 'next/server'
import { db } from '@/lib/database/pg-client'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { getOrgContext } from '@/lib/auth/get-org-context'
import { handleApiError } from '@/lib/api/handle-api-error'

export const dynamic = 'force-dynamic'

const ADMIN_EMAILS = ['chrisdoran63@outlook.com']
const DEFAULT_STICK_COLOR = '#fef3c7'

// GET /api/v2/social-sticks - List social sticks
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

    // Public sticks - no auth required
    if (isPublic) {
      const result = await db.query(
        `SELECT ss.*, sp.id as pad_id, sp.name as pad_name, sp.is_public
         FROM social_sticks ss
         INNER JOIN social_pads sp ON ss.social_pad_id = sp.id
         WHERE sp.is_public = true
         ORDER BY ss.created_at DESC`
      )

      const sticks = await enrichSticksWithData(result.rows)
      return new Response(JSON.stringify({ sticks }), { status: 200 })
    }

    // All other requests require authentication
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }

    // Admin view
    if (isAdmin) {
      const isUserAdmin = user.email && ADMIN_EMAILS.includes(user.email)
      if (!isUserAdmin) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 })
      }

      const result = await db.query(
        `SELECT ss.*, sp.id as pad_id, sp.name as pad_name
         FROM social_sticks ss
         LEFT JOIN social_pads sp ON ss.social_pad_id = sp.id
         ORDER BY ss.created_at DESC`
      )

      const sticks = await enrichSticksWithData(result.rows)
      return new Response(JSON.stringify({ sticks }), { status: 200 })
    }

    if (!orgContext) {
      // Fallback to public sticks only
      const result = await db.query(
        `SELECT ss.*, sp.id as pad_id, sp.name as pad_name
         FROM social_sticks ss
         INNER JOIN social_pads sp ON ss.social_pad_id = sp.id
         WHERE sp.is_public = true
         ORDER BY ss.created_at DESC`
      )
      const sticks = await enrichSticksWithData(result.rows)
      return new Response(JSON.stringify({ sticks }), { status: 200 })
    }

    // Private sticks only
    if (isPrivate) {
      const result = await db.query(
        `SELECT DISTINCT ss.*, sp.id as pad_id, sp.name as pad_name
         FROM social_sticks ss
         INNER JOIN social_pads sp ON ss.social_pad_id = sp.id
         LEFT JOIN social_pad_members spm ON sp.id = spm.social_pad_id AND spm.user_id = $1 AND spm.accepted = true
         WHERE ss.org_id = $2 AND sp.is_public = false
           AND (sp.owner_id = $1 OR spm.user_id IS NOT NULL)
         ORDER BY ss.created_at DESC`,
        [user.id, orgContext.orgId]
      )

      const sticks = await enrichSticksWithData(result.rows)
      return new Response(JSON.stringify({ sticks }), { status: 200 })
    }

    // Default: all accessible sticks (owned, member, and public)
    const result = await db.query(
      `SELECT DISTINCT ss.*, sp.id as pad_id, sp.name as pad_name, sp.is_public
       FROM social_sticks ss
       INNER JOIN social_pads sp ON ss.social_pad_id = sp.id
       LEFT JOIN social_pad_members spm ON sp.id = spm.social_pad_id AND spm.user_id = $1 AND spm.accepted = true
       WHERE sp.is_public = true
          OR sp.owner_id = $1
          OR spm.user_id IS NOT NULL
       ORDER BY ss.created_at DESC`,
      [user.id]
    )

    const sticks = await enrichSticksWithData(result.rows)
    return new Response(JSON.stringify({ sticks }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

// POST /api/v2/social-sticks - Create social stick
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
    const { topic, content, social_pad_id, color } = body

    if (!topic?.trim() || !social_pad_id) {
      return new Response(
        JSON.stringify({ error: 'Topic and pad are required' }),
        { status: 400 }
      )
    }

    // Check pad access
    const padResult = await db.query(
      `SELECT owner_id, org_id FROM social_pads WHERE id = $1`,
      [social_pad_id]
    )

    if (padResult.rows.length === 0) {
      return new Response(JSON.stringify({ error: 'Pad not found' }), { status: 404 })
    }

    const pad = padResult.rows[0]

    // Check membership if not owner
    if (pad.owner_id !== user.id) {
      const memberResult = await db.query(
        `SELECT role FROM social_pad_members
         WHERE social_pad_id = $1 AND user_id = $2 AND accepted = true AND org_id = $3`,
        [social_pad_id, user.id, orgContext.orgId]
      )

      if (memberResult.rows.length === 0) {
        return new Response(
          JSON.stringify({ error: "You don't have access to this pad" }),
          { status: 403 }
        )
      }
    }

    // Create stick
    const result = await db.query(
      `INSERT INTO social_sticks (topic, content, social_pad_id, user_id, org_id, color)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [topic.trim(), content?.trim() || '', social_pad_id, user.id, pad.org_id || orgContext.orgId, color || DEFAULT_STICK_COLOR]
    )

    return new Response(JSON.stringify({ stick: result.rows[0] }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

// Helper to enrich sticks with user data and reply counts
async function enrichSticksWithData(sticks: any[]) {
  if (!sticks || sticks.length === 0) return []

  const userIds = [...new Set(sticks.map((s) => s.user_id).filter(Boolean))]
  const stickIds = sticks.map((s) => s.id)

  // Get users
  let usersMap = new Map()
  if (userIds.length > 0) {
    const usersResult = await db.query(
      `SELECT id, full_name, email, avatar_url FROM users WHERE id = ANY($1)`,
      [userIds]
    )
    usersMap = new Map(usersResult.rows.map((u: any) => [u.id, u]))
  }

  // Get reply counts
  let replyCountMap = new Map()
  if (stickIds.length > 0) {
    const repliesResult = await db.query(
      `SELECT social_stick_id, COUNT(*) as count
       FROM social_stick_replies
       WHERE social_stick_id = ANY($1)
       GROUP BY social_stick_id`,
      [stickIds]
    )
    replyCountMap = new Map(repliesResult.rows.map((r: any) => [r.social_stick_id, parseInt(r.count, 10)]))
  }

  return sticks.map((stick) => ({
    ...stick,
    users: usersMap.get(stick.user_id) || null,
    reply_count: replyCountMap.get(stick.id) || 0,
    social_pads: stick.pad_id ? { id: stick.pad_id, name: stick.pad_name, is_public: stick.is_public } : null,
  }))
}

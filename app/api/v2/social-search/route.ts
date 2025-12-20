// v2 Social Search API: production-quality, search social sticks
import { type NextRequest } from 'next/server'
import { db } from '@/lib/database/pg-client'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { getOrgContext } from '@/lib/auth/get-org-context'
import { handleApiError } from '@/lib/api/handle-api-error'

export const dynamic = 'force-dynamic'

interface SearchParams {
  query: string
  dateFrom: string | null
  dateTo: string | null
  visibility: string | null
  authorId: string | null
  padId: string | null
  includeReplies: boolean
  sortBy: string
  sortOrder: string
}

function parseSearchParams(searchParams: URLSearchParams): SearchParams {
  return {
    query: searchParams.get('q') || '',
    dateFrom: searchParams.get('dateFrom'),
    dateTo: searchParams.get('dateTo'),
    visibility: searchParams.get('visibility'),
    authorId: searchParams.get('authorId'),
    padId: searchParams.get('padId'),
    includeReplies: searchParams.get('includeReplies') === 'true',
    sortBy: searchParams.get('sortBy') || 'created_at',
    sortOrder: searchParams.get('sortOrder') || 'desc',
  }
}

// GET /api/v2/social-search - Search social sticks
export async function GET(request: NextRequest) {
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

    const params = parseSearchParams(request.nextUrl.searchParams)

    // Get user's accessible pad IDs
    const memberPadsResult = await db.query(
      `SELECT social_pad_id FROM social_pad_members WHERE user_id = $1 AND org_id = $2`,
      [user.id, orgContext.orgId]
    )
    const padIds = memberPadsResult.rows.map((p: any) => p.social_pad_id)

    // Build sticks query with filters
    let sticksQuery = `
      SELECT
        ss.id, ss.topic, ss.content, ss.color, ss.created_at, ss.updated_at,
        ss.social_pad_id, ss.user_id, ss.is_public,
        sp.id as pad_id, sp.name as pad_name, sp.is_public as pad_is_public, sp.owner_id as pad_owner_id,
        u.id as author_id, u.full_name, u.email, u.username, u.avatar_url
      FROM social_sticks ss
      INNER JOIN social_pads sp ON sp.id = ss.social_pad_id
      LEFT JOIN users u ON u.id = ss.user_id
      WHERE ss.org_id = $1
        AND (sp.is_public = true OR sp.owner_id = $2`

    const queryParams: any[] = [orgContext.orgId, user.id]
    let paramIndex = 3

    if (padIds.length > 0) {
      sticksQuery += ` OR ss.social_pad_id = ANY($${paramIndex})`
      queryParams.push(padIds)
      paramIndex++
    }
    sticksQuery += ')'

    // Apply filters
    if (params.visibility === 'public') {
      sticksQuery += ` AND sp.is_public = true`
    } else if (params.visibility === 'private') {
      sticksQuery += ` AND sp.is_public = false`
    }

    if (params.authorId) {
      sticksQuery += ` AND ss.user_id = $${paramIndex}`
      queryParams.push(params.authorId)
      paramIndex++
    }

    if (params.padId) {
      sticksQuery += ` AND ss.social_pad_id = $${paramIndex}`
      queryParams.push(params.padId)
      paramIndex++
    }

    if (params.dateFrom) {
      sticksQuery += ` AND ss.created_at >= $${paramIndex}`
      queryParams.push(params.dateFrom)
      paramIndex++
    }

    if (params.dateTo) {
      sticksQuery += ` AND ss.created_at <= $${paramIndex}`
      queryParams.push(params.dateTo)
      paramIndex++
    }

    // Apply text search
    if (params.query) {
      const searchPattern = `%${params.query}%`
      sticksQuery += ` AND (ss.topic ILIKE $${paramIndex} OR ss.content ILIKE $${paramIndex} OR u.full_name ILIKE $${paramIndex} OR u.email ILIKE $${paramIndex})`
      queryParams.push(searchPattern)
      paramIndex++
    }

    // Apply sorting
    const sortColumn = params.sortBy === 'updated_at' ? 'ss.updated_at' : 'ss.created_at'
    const sortDirection = params.sortOrder === 'asc' ? 'ASC' : 'DESC'
    sticksQuery += ` ORDER BY ${sortColumn} ${sortDirection}`

    const sticksResult = await db.query(sticksQuery, queryParams)

    // Get reply counts for sticks
    const stickIds = sticksResult.rows.map((s: any) => s.id)
    let replyCountMap: Record<string, number> = {}

    if (stickIds.length > 0) {
      const replyCountsResult = await db.query(
        `SELECT social_stick_id, COUNT(*) as count
         FROM social_stick_replies
         WHERE social_stick_id = ANY($1) AND org_id = $2
         GROUP BY social_stick_id`,
        [stickIds, orgContext.orgId]
      )
      replyCountMap = Object.fromEntries(
        replyCountsResult.rows.map((r: any) => [r.social_stick_id, parseInt(r.count)])
      )
    }

    // Process sticks
    const sticks = sticksResult.rows.map((row: any) => ({
      id: row.id,
      topic: row.topic,
      content: row.content,
      color: row.color,
      created_at: row.created_at,
      updated_at: row.updated_at,
      social_pad_id: row.social_pad_id,
      user_id: row.user_id,
      is_public: row.is_public,
      social_pads: {
        id: row.pad_id,
        name: row.pad_name,
        is_public: row.pad_is_public,
        owner_id: row.pad_owner_id,
      },
      users: row.author_id ? {
        id: row.author_id,
        full_name: row.full_name,
        email: row.email,
        username: row.username,
        avatar_url: row.avatar_url,
      } : null,
      reply_count: replyCountMap[row.id] || 0,
    }))

    // Sort by reply count if requested
    if (params.sortBy === 'replies') {
      const multiplier = params.sortOrder === 'desc' ? 1 : -1
      sticks.sort((a: any, b: any) => multiplier * ((b.reply_count || 0) - (a.reply_count || 0)))
    }

    // Search replies if requested
    let replyResults: any[] = []
    if (params.includeReplies && params.query) {
      const repliesResult = await db.query(
        `SELECT
          ssr.id, ssr.content, ssr.category, ssr.created_at, ssr.social_stick_id, ssr.user_id,
          u.id as author_id, u.full_name, u.email, u.username, u.avatar_url,
          ss.id as stick_id, ss.topic as stick_topic, ss.social_pad_id,
          sp.id as pad_id, sp.name as pad_name, sp.is_public as pad_is_public
         FROM social_stick_replies ssr
         INNER JOIN social_sticks ss ON ss.id = ssr.social_stick_id
         INNER JOIN social_pads sp ON sp.id = ss.social_pad_id
         LEFT JOIN users u ON u.id = ssr.user_id
         WHERE ssr.org_id = $1
           AND ssr.content ILIKE $2
           AND (sp.is_public = true OR sp.id = ANY($3))`,
        [orgContext.orgId, `%${params.query}%`, padIds]
      )
      replyResults = repliesResult.rows
    }

    // Extract authors and pads for metadata
    const authorsMap = new Map<string, any>()
    const padsMap = new Map<string, any>()

    sticks.forEach((stick: any) => {
      if (stick.user_id && !authorsMap.has(stick.user_id)) {
        authorsMap.set(stick.user_id, {
          id: stick.user_id,
          name: stick.users?.full_name || stick.users?.email || 'Unknown',
          email: stick.users?.email || '',
        })
      }
      if (!padsMap.has(stick.social_pad_id)) {
        padsMap.set(stick.social_pad_id, {
          id: stick.social_pad_id,
          name: stick.social_pads?.name || 'Unknown',
        })
      }
    })

    return new Response(
      JSON.stringify({
        sticks,
        replies: replyResults,
        metadata: {
          totalSticks: sticks.length,
          totalReplies: replyResults.length,
          authors: Array.from(authorsMap.values()),
          pads: Array.from(padsMap.values()),
        },
      }),
      { status: 200 }
    )
  } catch (error) {
    return handleApiError(error)
  }
}

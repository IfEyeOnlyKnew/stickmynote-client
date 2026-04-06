// Inference Search handler - shared logic between v1 and v2 API routes
import { db } from '@/lib/database/pg-client'
import type { OrgContext } from '@/lib/auth/get-org-context'

// ============================================================================
// Types
// ============================================================================

export interface SearchParams {
  query: string
  dateFrom: string | null
  dateTo: string | null
  visibility: string | null
  authorId: string | null
  padId: string | null
  includeReplies: boolean
  sortBy: string
  sortOrder: string
  limit: number
  offset: number
}

// ============================================================================
// Helpers
// ============================================================================

export function parseSearchParams(searchParams: URLSearchParams): SearchParams {
  const rawLimit = Number.parseInt(searchParams.get('limit') || '20', 10)
  const rawOffset = Number.parseInt(searchParams.get('offset') || '0', 10)

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
    limit: Math.min(Math.max(rawLimit, 1), 100),
    offset: Math.max(rawOffset, 0),
  }
}

// ============================================================================
// GET: Search sticks
// ============================================================================

// ============================================================================
// Query building helpers
// ============================================================================

interface QueryBuilder {
  query: string
  params: any[]
  paramIndex: number
}

function addOptionalFilter(
  builder: QueryBuilder,
  value: string | null,
  clause: string,
): void {
  if (!value) return
  builder.query += ` AND ${clause.replace('?', `$${builder.paramIndex}`)}`
  builder.params.push(value)
  builder.paramIndex++
}

function applySearchFilters(builder: QueryBuilder, params: SearchParams): void {
  if (params.visibility === 'public') {
    builder.query += ` AND sp.is_public = true`
  } else if (params.visibility === 'private') {
    builder.query += ` AND sp.is_public = false`
  }

  addOptionalFilter(builder, params.authorId, 'ss.user_id = ?')
  addOptionalFilter(builder, params.padId, 'ss.social_pad_id = ?')
  addOptionalFilter(builder, params.dateFrom, 'ss.created_at >= ?')
  addOptionalFilter(builder, params.dateTo, 'ss.created_at <= ?')

  if (params.query) {
    const searchPattern = `%${params.query}%`
    builder.query += ` AND (ss.topic ILIKE $${builder.paramIndex} OR ss.content ILIKE $${builder.paramIndex} OR u.full_name ILIKE $${builder.paramIndex} OR u.email ILIKE $${builder.paramIndex})`
    builder.params.push(searchPattern)
    builder.paramIndex++
  }
}

function applySorting(builder: QueryBuilder, params: SearchParams): void {
  const sortColumn = params.sortBy === 'updated_at' ? 'ss.updated_at' : 'ss.created_at'
  const sortDirection = params.sortOrder === 'asc' ? 'ASC' : 'DESC'
  builder.query += ` ORDER BY ${sortColumn} ${sortDirection}`
}

function buildSticksQuery(params: SearchParams, orgId: string, userId: string, padIds: string[]): QueryBuilder {
  const builder: QueryBuilder = {
    query: `
      SELECT
        ss.id, ss.topic, ss.content, ss.color, ss.created_at, ss.updated_at,
        ss.social_pad_id, ss.user_id, ss.is_public,
        sp.id as pad_id, sp.name as pad_name, sp.is_public as pad_is_public, sp.owner_id as pad_owner_id,
        u.id as author_id, u.full_name, u.email, u.username, u.avatar_url
      FROM social_sticks ss
      INNER JOIN social_pads sp ON sp.id = ss.social_pad_id
      LEFT JOIN users u ON u.id = ss.user_id
      WHERE ss.org_id = $1
        AND (sp.is_public = true OR sp.owner_id = $2`,
    params: [orgId, userId],
    paramIndex: 3,
  }

  if (padIds.length > 0) {
    builder.query += ` OR ss.social_pad_id = ANY($${builder.paramIndex})`
    builder.params.push(padIds)
    builder.paramIndex++
  }
  builder.query += ')'

  applySearchFilters(builder, params)
  applySorting(builder, params)

  return builder
}

// ============================================================================
// Result processing helpers
// ============================================================================

async function fetchReplyCountMap(stickIds: string[], orgId: string): Promise<Record<string, number>> {
  if (stickIds.length === 0) return {}

  const replyCountsResult = await db.query(
    `SELECT social_stick_id, COUNT(*) as count
     FROM social_stick_replies
     WHERE social_stick_id = ANY($1) AND org_id = $2
     GROUP BY social_stick_id`,
    [stickIds, orgId]
  )
  return Object.fromEntries(
    replyCountsResult.rows.map((r: any) => [r.social_stick_id, Number.parseInt(r.count)])
  )
}

function mapRowToStick(row: any, replyCount: number) {
  return {
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
    users: row.author_id
      ? { id: row.author_id, full_name: row.full_name, email: row.email, username: row.username, avatar_url: row.avatar_url }
      : null,
    reply_count: replyCount,
  }
}

async function searchReplies(params: SearchParams, orgId: string, padIds: string[]): Promise<any[]> {
  if (!params.includeReplies || !params.query) return []

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
    [orgId, `%${params.query}%`, padIds]
  )
  return repliesResult.rows
}

function extractMetadata(sticks: any[]) {
  const authorsMap = new Map<string, any>()
  const padsMap = new Map<string, any>()

  for (const stick of sticks) {
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
  }

  return {
    authors: Array.from(authorsMap.values()),
    pads: Array.from(padsMap.values()),
  }
}

// ============================================================================
// Main search function
// ============================================================================

export async function searchSticks(
  params: SearchParams,
  user: { id: string },
  orgContext: OrgContext
): Promise<{ status: number; body: any }> {
  const memberPadsResult = await db.query(
    `SELECT social_pad_id FROM social_pad_members WHERE user_id = $1 AND org_id = $2`,
    [user.id, orgContext.orgId]
  )
  const padIds = memberPadsResult.rows.map((p: any) => p.social_pad_id)

  const builder = buildSticksQuery(params, orgContext.orgId, user.id, padIds)
  const sticksResult = await db.query(builder.query, builder.params)

  const stickIds = sticksResult.rows.map((s: any) => s.id)
  const replyCountMap = await fetchReplyCountMap(stickIds, orgContext.orgId)

  let sticks = sticksResult.rows.map((row: any) => mapRowToStick(row, replyCountMap[row.id] || 0))

  if (params.sortBy === 'replies') {
    const multiplier = params.sortOrder === 'desc' ? 1 : -1
    sticks.sort((a: any, b: any) => multiplier * ((b.reply_count || 0) - (a.reply_count || 0)))
  }

  const replyResults = await searchReplies(params, orgContext.orgId, padIds)
  const { authors, pads } = extractMetadata(sticks)

  return {
    status: 200,
    body: {
      sticks,
      replies: replyResults,
      metadata: {
        totalSticks: sticks.length,
        totalReplies: replyResults.length,
        total: sticks.length,
        hasMore: false,
        authors,
        pads,
      },
    },
  }
}

// v2 Search Panel API: production-quality, panel search
import { type NextRequest } from 'next/server'
import { db } from '@/lib/database/pg-client'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { handleApiError } from '@/lib/api/handle-api-error'

export const dynamic = 'force-dynamic'

type Timeframe = 'day' | 'week' | 'month' | 'all'
type SortOption = 'relevance' | 'newest' | 'oldest' | 'most_replies'

interface SearchFilters {
  tags?: string[]
  timeframe?: Timeframe
  shared?: 'all' | 'shared' | 'personal'
  colors?: string[]
  sortBy?: SortOption
}

const TIMEFRAME_DAYS: Record<Exclude<Timeframe, 'all'>, number> = {
  day: 1,
  week: 7,
  month: 30,
}

// POST /api/v2/search/panel - Panel search
export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    const body = await request.json()
    const { query, filters = {}, page = 1, limit = 20 } = body
    const { tags, timeframe, colors, sortBy = 'newest' } = filters as SearchFilters

    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) {
      return new Response(
        JSON.stringify({
          error: 'Rate limit exceeded',
          notes: [],
          totalCount: 0,
          page,
          hasMore: false,
          searchDuration: Date.now() - startTime,
          rateLimited: true,
        }),
        { status: 429, headers: { 'Retry-After': '30' } }
      )
    }

    // Build query
    const conditions: string[] = ['is_shared = true']
    const params: any[] = []
    let paramIndex = 1

    // Text search
    if (query?.trim()) {
      const searchTerm = `%${query.trim().toLowerCase()}%`
      conditions.push(`(LOWER(topic) LIKE $${paramIndex} OR LOWER(content) LIKE $${paramIndex})`)
      params.push(searchTerm)
      paramIndex++
    }

    // Timeframe filter
    if (timeframe && timeframe !== 'all' && TIMEFRAME_DAYS[timeframe]) {
      const days = TIMEFRAME_DAYS[timeframe]
      conditions.push(`created_at >= NOW() - INTERVAL '${days} days'`)
    }

    // Color filter
    if (colors?.length) {
      conditions.push(`color = ANY($${paramIndex})`)
      params.push(colors)
      paramIndex++
    }

    const whereClause = conditions.join(' AND ')

    // Get count
    const countResult = await db.query(
      `SELECT COUNT(*) FROM personal_sticks WHERE ${whereClause}`,
      params
    )
    const totalCount = Number.parseInt(countResult.rows[0]?.count || '0', 10)

    // Sort order
    const ascending = sortBy === 'oldest'
    const orderBy = ascending ? 'ASC' : 'DESC'

    // Get notes
    const offset = (page - 1) * limit
    const notesResult = await db.query(
      `SELECT n.*,
              (SELECT COUNT(*) FROM personal_sticks_replies WHERE personal_stick_id = n.id) as reply_count
       FROM personal_sticks n
       WHERE ${whereClause}
       ORDER BY created_at ${orderBy}
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    )

    let notes = notesResult.rows || []

    // Get user data
    const userIds = [...new Set(notes.map((n: any) => n.user_id).filter(Boolean))]
    let usersMap: Record<string, any> = {}

    if (userIds.length > 0) {
      const usersResult = await db.query(
        `SELECT id, username, full_name, avatar_url FROM users WHERE id = ANY($1)`,
        [userIds]
      )
      usersMap = usersResult.rows.reduce((acc: any, u: any) => {
        acc[u.id] = u
        return acc
      }, {})
    }

    // Get tags for notes
    const noteIds = notes.map((n: any) => n.id)
    let tagsMap: Record<string, string[]> = {}

    if (noteIds.length > 0) {
      const tagsResult = await db.query(
        `SELECT personal_stick_id, tag_title FROM personal_sticks_tags WHERE personal_stick_id = ANY($1)`,
        [noteIds]
      )
      tagsResult.rows.forEach((t: any) => {
        if (!tagsMap[t.personal_stick_id]) tagsMap[t.personal_stick_id] = []
        tagsMap[t.personal_stick_id].push(t.tag_title)
      })
    }

    // Filter by tags if specified
    if (tags?.length) {
      const lowerTags = tags.map((t) => t.toLowerCase())
      notes = notes.filter((note: any) => {
        const noteTags = new Set((tagsMap[note.id] || []).map((t) => t.toLowerCase()))
        return lowerTags.some((tag) => noteTags.has(tag))
      })
    }

    // Enrich notes
    const enrichedNotes = notes.map((note: any) => ({
      ...note,
      user: usersMap[note.user_id] || null,
      reply_count: Number.parseInt(note.reply_count || '0', 10),
      view_count: 0,
      like_count: 0,
      tags: tagsMap[note.id] || [],
    }))

    return new Response(
      JSON.stringify({
        notes: enrichedNotes,
        totalCount,
        page,
        hasMore: totalCount > offset + enrichedNotes.length,
        searchDuration: Date.now() - startTime,
      }),
      { status: 200 }
    )
  } catch (error) {
    return handleApiError(error)
  }
}

// GET /api/v2/search/panel - Get suggestions
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

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'all'

    const suggestions: { recent: string[]; trending: string[]; tags: string[] } = {
      recent: [],
      trending: [],
      tags: [],
    }

    // Get recent searches
    if (type === 'all' || type === 'recent') {
      try {
        const recentResult = await db.query(
          `SELECT DISTINCT query FROM search_history
           WHERE user_id = $1 AND query IS NOT NULL
           ORDER BY MAX(created_at) DESC
           LIMIT 5`,
          [user.id]
        )
        suggestions.recent = recentResult.rows.map((r: any) => r.query)
      } catch {
        // Table might not exist
      }
    }

    // Get trending tags
    if (type === 'all' || type === 'trending') {
      try {
        const trendingResult = await db.query(
          `SELECT tag, usage_count FROM trending_tags ORDER BY usage_count DESC LIMIT 20`
        )
        suggestions.trending = trendingResult.rows.map((t: any) => t.tag)
      } catch {
        // Table might not exist
      }
    }

    // Get all available tags
    if (type === 'all' || type === 'tags') {
      const tagsResult = await db.query(
        `SELECT DISTINCT tag_title FROM personal_sticks_tags ORDER BY tag_title LIMIT 50`
      )
      suggestions.tags = tagsResult.rows.map((t: any) => t.tag_title)
    }

    return new Response(JSON.stringify(suggestions), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

// Search panel handler logic - extracted for v1/v2 deduplication
import { db } from '@/lib/database/pg-client'

// ============================================================================
// Types
// ============================================================================

export type Timeframe = 'day' | 'week' | 'month' | 'all'
export type SortOption = 'relevance' | 'newest' | 'oldest' | 'most_replies'

export interface SearchFilters {
  tags?: string[]
  timeframe?: Timeframe
  shared?: 'all' | 'shared' | 'personal'
  colors?: string[]
  sortBy?: SortOption
}

export interface SearchUser {
  id: string
}

// ============================================================================
// Constants
// ============================================================================

const TIMEFRAME_DAYS: Record<Exclude<Timeframe, 'all'>, number> = {
  day: 1,
  week: 7,
  month: 30,
}

// ============================================================================
// POST: Panel search
// ============================================================================

export interface PanelSearchInput {
  query?: string
  filters?: SearchFilters
  page?: number
  limit?: number
}

export async function panelSearch(input: PanelSearchInput) {
  const { query, filters = {}, page = 1, limit = 20 } = input
  const { tags, timeframe, colors, sortBy = 'newest' } = filters
  const startTime = Date.now()

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
    params,
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
    [...params, limit, offset],
  )

  let notes = notesResult.rows || []

  // Get user data
  const userIds = [...new Set(notes.map((n: any) => n.user_id).filter(Boolean))]
  let usersMap: Record<string, any> = {}

  if (userIds.length > 0) {
    const usersResult = await db.query(
      `SELECT id, username, full_name, avatar_url FROM users WHERE id = ANY($1)`,
      [userIds],
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
      [noteIds],
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

  return {
    notes: enrichedNotes,
    totalCount,
    page,
    hasMore: totalCount > offset + enrichedNotes.length,
    searchDuration: Date.now() - startTime,
  }
}

// ============================================================================
// GET: Search suggestions
// ============================================================================

export async function getSearchSuggestions(user: SearchUser, type: string = 'all') {
  const suggestions: { recent: string[]; trending: string[]; tags: string[] } = {
    recent: [],
    trending: [],
    tags: [],
  }

  // Get recent searches
  if (type === 'all' || type === 'recent') {
    try {
      const recentResult = await db.query(
        `SELECT query FROM search_history
         WHERE user_id = $1 AND query IS NOT NULL AND query != ''
         ORDER BY created_at DESC
         LIMIT 10`,
        [user.id],
      )
      const queries = recentResult.rows
        .map((r: any) => String(r.query || ''))
        .filter((q) => q.length > 0)
      suggestions.recent = [...new Set(queries)].slice(0, 5)
    } catch {
      // search_history table might not exist
    }
  }

  // Get tags from shared notes
  if (type === 'all' || type === 'trending' || type === 'tags') {
    try {
      const sharedNotesResult = await db.query(
        `SELECT id FROM personal_sticks WHERE is_shared = true LIMIT 200`,
      )
      const sharedNoteIds = sharedNotesResult.rows.map((n: any) => n.id)

      if (sharedNoteIds.length > 0) {
        const tabsResult = await db.query(
          `SELECT tags, personal_stick_id FROM personal_sticks_tabs
           WHERE personal_stick_id = ANY($1) AND tags IS NOT NULL`,
          [sharedNoteIds],
        )

        const tagCounts = new Map<string, number>()
        const tagSet = new Set<string>()

        tabsResult.rows.forEach((tab: any) => {
          if (tab.tags) {
            let tagArray: string[] = []

            if (Array.isArray(tab.tags)) {
              tagArray = tab.tags
            } else if (typeof tab.tags === 'string') {
              try {
                tagArray = JSON.parse(tab.tags)
              } catch {
                tagArray = []
              }
            } else if (typeof tab.tags === 'object') {
              tagArray = Object.values(tab.tags).filter(
                (t): t is string => typeof t === 'string',
              )
            }

            tagArray.forEach((tag: any) => {
              const tagStr = typeof tag === 'string' ? tag : tag?.name || ''
              if (tagStr) {
                tagSet.add(tagStr)
                tagCounts.set(tagStr, (tagCounts.get(tagStr) || 0) + 1)
              }
            })
          }
        })

        // Trending tags (sorted by count)
        if (type === 'all' || type === 'trending') {
          suggestions.trending = Array.from(tagCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([tag]) => tag)
        }

        // All available tags (sorted alphabetically)
        if (type === 'all' || type === 'tags') {
          suggestions.tags = Array.from(tagSet).sort((a, b) => a.localeCompare(b))
        }
      }
    } catch {
      // Handle error silently
    }
  }

  return suggestions
}

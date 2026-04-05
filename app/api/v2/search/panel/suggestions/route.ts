// v2 Search Panel Suggestions API: production-quality, get search suggestions
import { type NextRequest } from 'next/server'
import { db } from '@/lib/database/pg-client'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { handleApiError } from '@/lib/api/handle-api-error'

export const dynamic = 'force-dynamic'

// GET /api/v2/search/panel/suggestions - Get search suggestions
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

    let recentSearches: string[] = []
    let trendingTags: string[] = []
    let availableTags: string[] = []

    // Get recent searches
    try {
      const recentResult = await db.query(
        `SELECT query FROM search_history
         WHERE user_id = $1 AND query IS NOT NULL AND query != ''
         ORDER BY created_at DESC
         LIMIT 10`,
        [user.id]
      )
      const queries = recentResult.rows.map((r: any) => String(r.query || '')).filter((q) => q.length > 0)
      recentSearches = [...new Set(queries)].slice(0, 5)
    } catch {
      // search_history table might not exist
    }

    // Get tags from shared notes
    try {
      const sharedNotesResult = await db.query(
        `SELECT id FROM personal_sticks WHERE is_shared = true LIMIT 200`
      )
      const sharedNoteIds = sharedNotesResult.rows.map((n: any) => n.id)

      if (sharedNoteIds.length > 0) {
        const tabsResult = await db.query(
          `SELECT tags, personal_stick_id FROM personal_sticks_tabs
           WHERE personal_stick_id = ANY($1) AND tags IS NOT NULL`,
          [sharedNoteIds]
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
              tagArray = Object.values(tab.tags).filter((t): t is string => typeof t === 'string')
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

        // Get trending tags (sorted by count)
        trendingTags = Array.from(tagCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([tag]) => tag)

        // Get all available tags (sorted alphabetically)
        availableTags = Array.from(tagSet).sort((a, b) => a.localeCompare(b))
      }
    } catch {
      // Handle error silently
    }

    return new Response(
      JSON.stringify({
        recent: recentSearches,
        trending: trendingTags,
        tags: availableTags,
      }),
      { status: 200 }
    )
  } catch (error) {
    return handleApiError(error)
  }
}

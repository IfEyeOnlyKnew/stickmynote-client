// v2 Search Advanced API: production-quality, advanced search with filters
import { type NextRequest } from 'next/server'
import { db } from '@/lib/database/pg-client'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { handleApiError } from '@/lib/api/handle-api-error'

export const dynamic = 'force-dynamic'

// POST /api/v2/search/advanced - Advanced search with filters
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

    const body = await request.json()
    const { query, filters, page = 1, limit = 20, sortBy = 'created_at', sortOrder = 'desc' } = body

    // Build WHERE conditions
    const conditions: string[] = ['user_id = $1']
    const params: any[] = [user.id]
    let paramIndex = 2

    // Apply text search
    if (query?.trim()) {
      const searchTerm = query.trim().toLowerCase()
      if (query.includes(':')) {
        // Topic-only search
        const keywords = query.split(':').map((w: string) => w.trim()).filter((w: string) => w)
        keywords.forEach((keyword: string) => {
          conditions.push(`LOWER(topic) LIKE $${paramIndex}`)
          params.push(`%${keyword}%`)
          paramIndex++
        })
      } else {
        // Search both topic and content
        conditions.push(`(LOWER(topic) LIKE $${paramIndex} OR LOWER(content) LIKE $${paramIndex})`)
        params.push(`%${searchTerm}%`)
        paramIndex++
      }
    }

    // Apply date range filter
    if (filters?.dateRange?.from) {
      conditions.push(`created_at >= $${paramIndex}`)
      params.push(filters.dateRange.from)
      paramIndex++
    }
    if (filters?.dateRange?.to) {
      conditions.push(`created_at <= $${paramIndex}`)
      params.push(filters.dateRange.to)
      paramIndex++
    }

    // Apply shared filter
    if (filters?.shared !== null && filters?.shared !== undefined) {
      conditions.push(`is_shared = $${paramIndex}`)
      params.push(filters.shared)
      paramIndex++
    }

    // Apply color filter
    if (filters?.color) {
      conditions.push(`color = $${paramIndex}`)
      params.push(filters.color)
      paramIndex++
    }

    const whereClause = conditions.join(' AND ')

    // Get total count
    const countResult = await db.query(
      `SELECT COUNT(*) FROM personal_sticks WHERE ${whereClause}`,
      params
    )
    const totalCount = parseInt(countResult.rows[0]?.count || '0', 10)

    // Validate sort column
    const allowedSortColumns = ['created_at', 'updated_at', 'topic', 'title']
    const safeSortBy = allowedSortColumns.includes(sortBy) ? sortBy : 'created_at'
    const safeSortOrder = sortOrder === 'asc' ? 'ASC' : 'DESC'

    // Get notes with replies count
    const offset = (page - 1) * limit
    const notesResult = await db.query(
      `SELECT n.*,
              (SELECT COUNT(*) FROM personal_sticks_replies WHERE personal_stick_id = n.id) as reply_count
       FROM personal_sticks n
       WHERE ${whereClause}
       ORDER BY ${safeSortBy} ${safeSortOrder}
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    )

    return new Response(
      JSON.stringify({
        notes: notesResult.rows || [],
        totalCount,
        page,
        hasMore: totalCount > page * limit,
      }),
      { status: 200 }
    )
  } catch (error) {
    return handleApiError(error)
  }
}

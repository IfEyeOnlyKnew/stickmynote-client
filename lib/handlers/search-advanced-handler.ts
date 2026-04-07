// Search Advanced handler - shared logic between v1 and v2 API routes
import { db } from '@/lib/database/pg-client'

// ============================================================================
// Types
// ============================================================================

export interface AdvancedSearchInput {
  query?: string
  filters?: {
    dateRange?: { from?: string; to?: string }
    shared?: boolean | null
    color?: string
  }
  page?: number
  limit?: number
  sortBy?: string
  sortOrder?: string
}

export interface AdvancedSearchResult {
  notes: any[]
  totalCount: number
  page: number
  hasMore: boolean
}

// ============================================================================
// Core Logic
// ============================================================================

const ALLOWED_SORT_COLUMNS = new Set(['created_at', 'updated_at', 'topic', 'title'])

/**
 * Build WHERE conditions and params for advanced search.
 * Table-agnostic: caller specifies the table and reply table names.
 */
export function buildAdvancedSearchQuery(
  userId: string,
  input: AdvancedSearchInput,
  options: { table: string; replyTable: string; replyForeignKey: string }
): {
  countQuery: string
  dataQuery: string
  params: any[]
} {
  const { query, filters, page = 1, limit = 20, sortBy = 'created_at', sortOrder = 'desc' } = input
  const { table, replyTable, replyForeignKey } = options

  const conditions: string[] = ['user_id = $1']
  const params: any[] = [userId]
  let paramIndex = 2

  // Apply text search
  if (query?.trim()) {
    const searchTerm = query.trim().toLowerCase()
    if (query.includes(':')) {
      const keywords = query.split(':').map((w: string) => w.trim()).filter(Boolean)
      keywords.forEach((keyword: string) => {
        conditions.push(`LOWER(topic) LIKE $${paramIndex}`)
        params.push(`%${keyword}%`)
        paramIndex++
      })
    } else {
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

  // Validate sort column
  const safeSortBy = ALLOWED_SORT_COLUMNS.has(sortBy) ? sortBy : 'created_at'
  const safeSortOrder = sortOrder === 'asc' ? 'ASC' : 'DESC'

  const offset = (page - 1) * limit

  const countQuery = `SELECT COUNT(*) FROM ${table} WHERE ${whereClause}`

  const dataQuery = `SELECT n.*,
    (SELECT COUNT(*) FROM ${replyTable} WHERE ${replyForeignKey} = n.id) as reply_count
    FROM ${table} n
    WHERE ${whereClause}
    ORDER BY ${safeSortBy} ${safeSortOrder}
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`

  // Add limit and offset to params
  params.push(limit, offset)

  return { countQuery, dataQuery, params }
}

/**
 * Execute the advanced search for a given table configuration.
 */
export async function executeAdvancedSearch(
  userId: string,
  input: AdvancedSearchInput,
  options: { table: string; replyTable: string; replyForeignKey: string }
): Promise<AdvancedSearchResult> {
  const page = input.page ?? 1
  const limit = input.limit ?? 20

  const { countQuery, dataQuery, params } = buildAdvancedSearchQuery(userId, input, options)

  // Count uses params without limit/offset (last two)
  const countParams = params.slice(0, -2)
  const countResult = await db.query(countQuery, countParams)
  const totalCount = Number.parseInt(countResult.rows[0]?.count || '0', 10)

  const notesResult = await db.query(dataQuery, params)

  return {
    notes: notesResult.rows || [],
    totalCount,
    page,
    hasMore: totalCount > page * limit,
  }
}

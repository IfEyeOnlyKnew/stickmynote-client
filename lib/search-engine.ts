import { createDatabaseClient } from "@/lib/database/database-adapter"

export interface SearchOptions {
  query: string
  limit?: number
  offset?: number
  fuzzy?: boolean
  userId?: string
  filter?: "all" | "personal" | "shared"
  orgId?: string
}

export interface SearchResult<T> {
  results: T[]
  total: number
  hasMore: boolean
  searchTime: number
}

export class SearchEngine {
  /**
   * Search notes using full-text search with optional fuzzy matching
   */
  static async searchNotes(options: SearchOptions): Promise<SearchResult<any>> {
    const startTime = performance.now()
    const { query, limit = 20, offset = 0, fuzzy = true, userId, filter = "all", orgId } = options

    const db = await createDatabaseClient()

    // Build the search query
    let dbQuery = db.from("notes").select(
      `
        id, topic, content, color, position_x, position_y, is_shared,
        created_at, updated_at, user_id, z_index
      `,
      { count: "exact" },
    )

    if (orgId) {
      dbQuery = dbQuery.eq("org_id", orgId)
    }

    // Apply user filter if provided
    if (userId) {
      if (filter === "personal") {
        dbQuery = dbQuery.eq("user_id", userId).eq("is_shared", false)
      } else if (filter === "shared") {
        dbQuery = dbQuery.eq("is_shared", true)
      } else {
        // All: user's notes OR shared notes
        dbQuery = dbQuery.or(`user_id.eq.${userId},is_shared.eq.true`)
      }
    }

    // Apply search with fuzzy matching if enabled
    if (query && query.trim()) {
      if (fuzzy) {
        // Use trigram similarity for fuzzy search (handles typos)
        dbQuery = dbQuery.or(
          `topic.ilike.%${query}%,content.ilike.%${query}%,topic.fts(english).${query},content.fts(english).${query}`,
        )
      } else {
        // Exact full-text search
        dbQuery = dbQuery.or(`topic.fts(english).${query},content.fts(english).${query}`)
      }
    }

    // Apply pagination and ordering
    dbQuery = dbQuery.order("updated_at", { ascending: false }).range(offset, offset + limit - 1)

    const { data, error, count } = await dbQuery

    if (error) {
      console.error("[SearchEngine] Error searching notes:", error)
      throw error
    }

    const searchTime = performance.now() - startTime

    return {
      results: data || [],
      total: count || 0,
      hasMore: (count || 0) > offset + limit,
      searchTime: Math.round(searchTime),
    }
  }

  /**
   * Search pads using full-text search with optional fuzzy matching
   */
  static async searchPads(options: SearchOptions): Promise<SearchResult<any>> {
    const startTime = performance.now()
    const { query, limit = 50, offset = 0, fuzzy = true, userId, orgId } = options

    const db = await createDatabaseClient()

    let dbQuery = db.from("paks_pads").select(
      `
        id, name, description, owner_id, created_at, updated_at
      `,
      { count: "exact" },
    )

    if (orgId) {
      dbQuery = dbQuery.eq("org_id", orgId)
    }

    // Filter by user access (owned or member)
    if (userId) {
      dbQuery = dbQuery.or(`owner_id.eq.${userId},paks_pad_members.user_id.eq.${userId}`)
    }

    // Apply search
    if (query && query.trim()) {
      if (fuzzy) {
        dbQuery = dbQuery.or(
          `name.ilike.%${query}%,description.ilike.%${query}%,name.fts(english).${query},description.fts(english).${query}`,
        )
      } else {
        dbQuery = dbQuery.or(`name.fts(english).${query},description.fts(english).${query}`)
      }
    }

    dbQuery = dbQuery.order("created_at", { ascending: false }).range(offset, offset + limit - 1)

    const { data, error, count } = await dbQuery

    if (error) {
      console.error("[SearchEngine] Error searching pads:", error)
      throw error
    }

    const searchTime = performance.now() - startTime

    return {
      results: data || [],
      total: count || 0,
      hasMore: (count || 0) > offset + limit,
      searchTime: Math.round(searchTime),
    }
  }

  /**
   * Search sticks using full-text search with optional fuzzy matching
   */
  static async searchSticks(options: SearchOptions): Promise<SearchResult<any>> {
    const startTime = performance.now()
    const { query, limit = 50, offset = 0, fuzzy = true, userId, orgId } = options

    const db = await createDatabaseClient()

    let dbQuery = db.from("paks_pad_sticks").select(
      `
        id, topic, content, color, pad_id, user_id, created_at, updated_at,
        pads:paks_pads(id, name, owner_id)
      `,
      { count: "exact" },
    )

    if (orgId) {
      dbQuery = dbQuery.eq("org_id", orgId)
    }

    // Filter by user
    if (userId) {
      dbQuery = dbQuery.eq("user_id", userId)
    }

    // Apply search
    if (query && query.trim()) {
      if (fuzzy) {
        dbQuery = dbQuery.or(
          `topic.ilike.%${query}%,content.ilike.%${query}%,topic.fts(english).${query},content.fts(english).${query}`,
        )
      } else {
        dbQuery = dbQuery.or(`topic.fts(english).${query},content.fts(english).${query}`)
      }
    }

    dbQuery = dbQuery.order("updated_at", { ascending: false }).range(offset, offset + limit - 1)

    const { data, error, count } = await dbQuery

    if (error) {
      console.error("[SearchEngine] Error searching sticks:", error)
      throw error
    }

    const searchTime = performance.now() - startTime

    return {
      results: data || [],
      total: count || 0,
      hasMore: (count || 0) > offset + limit,
      searchTime: Math.round(searchTime),
    }
  }

  /**
   * Universal search across notes, pads, and sticks
   */
  static async searchAll(options: SearchOptions): Promise<{
    notes: SearchResult<any>
    pads: SearchResult<any>
    sticks: SearchResult<any>
    totalTime: number
  }> {
    const startTime = performance.now()

    const [notes, pads, sticks] = await Promise.all([
      this.searchNotes(options),
      this.searchPads(options),
      this.searchSticks(options),
    ])

    const totalTime = performance.now() - startTime

    return {
      notes,
      pads,
      sticks,
      totalTime: Math.round(totalTime),
    }
  }
}

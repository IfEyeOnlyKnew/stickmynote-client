import { getSession } from "@/lib/auth/local-auth"
import { NextResponse } from "next/server"
import { db } from "@/lib/database/pg-client"

// POST /api/search/advanced - Advanced search with filters
export async function POST(request: Request) {
  try {
    const session = await getSession()

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const user = session.user

    const body = await request.json()
    const { query, filters, page = 1, limit = 20, sortBy = "created_at", sortOrder = "desc" } = body

    // Build WHERE conditions
    const conditions: string[] = ["user_id = $1"]
    const params: any[] = [user.id]
    let paramIndex = 2

    // Apply text search
    if (query && query.trim()) {
      const searchTerm = query.trim().toLowerCase()
      if (query.includes(":")) {
        // Topic-only search
        const keywords = query
          .split(":")
          .map((w: string) => w.trim())
          .filter((w: string) => w)
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

    const whereClause = conditions.join(" AND ")

    // Get total count
    const countQuery = `SELECT COUNT(*) FROM notes WHERE ${whereClause}`
    const countResult = await db.query(countQuery, params)
    const totalCount = Number.parseInt(countResult.rows[0].count)

    // Get notes with replies count
    const offset = (page - 1) * limit
    const notesQuery = `
      SELECT n.*, 
             (SELECT COUNT(*) FROM replies WHERE note_id = n.id) as reply_count
      FROM notes n
      WHERE ${whereClause}
      ORDER BY ${sortBy} ${sortOrder === "asc" ? "ASC" : "DESC"}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `
    params.push(limit, offset)

    const notesResult = await db.query(notesQuery, params)
    const notes = notesResult.rows

    return NextResponse.json({
      notes: notes || [],
      totalCount,
      page,
      hasMore: totalCount > page * limit,
    })
  } catch (error) {
    console.error("Error in advanced search:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

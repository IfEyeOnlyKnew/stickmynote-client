// v2 Saved Searches API: production-quality, manage saved searches
import { type NextRequest } from 'next/server'
import { db } from '@/lib/database/pg-client'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { handleApiError } from '@/lib/api/handle-api-error'

export const dynamic = 'force-dynamic'

// GET /api/v2/saved-searches - Fetch saved searches
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

    const result = await db.query(
      `SELECT * FROM saved_searches WHERE user_id = $1 ORDER BY created_at DESC`,
      [user.id]
    )

    return new Response(JSON.stringify({ savedSearches: result.rows }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

// POST /api/v2/saved-searches - Create saved search
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
    const { name, query, filters } = body

    if (!name || !query) {
      return new Response(JSON.stringify({ error: 'Name and query are required' }), { status: 400 })
    }

    const result = await db.query(
      `INSERT INTO saved_searches (user_id, name, query, filters)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [user.id, name, query, JSON.stringify(filters || {})]
    )

    return new Response(JSON.stringify({ savedSearch: result.rows[0] }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

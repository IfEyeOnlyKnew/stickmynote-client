// v2 Social Accounts API: production-quality, manage social accounts
import { type NextRequest } from 'next/server'
import { db } from '@/lib/database/pg-client'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { handleApiError } from '@/lib/api/handle-api-error'

export const dynamic = 'force-dynamic'

// GET /api/v2/inference-accounts - Get user's social accounts
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
      `SELECT * FROM social_accounts
       WHERE owner_id = $1
       ORDER BY created_at DESC`,
      [user.id]
    )

    return new Response(JSON.stringify({ accounts: result.rows }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

// POST /api/v2/inference-accounts - Create a social account
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
    const { username, email, full_name } = body

    if (!email) {
      return new Response(JSON.stringify({ error: 'Email is required' }), { status: 400 })
    }

    // Check for existing account with same email
    const existingResult = await db.query(
      `SELECT id FROM social_accounts WHERE owner_id = $1 AND email = $2`,
      [user.id, email]
    )

    if (existingResult.rows.length > 0) {
      return new Response(
        JSON.stringify({ error: 'Account with this email already exists' }),
        { status: 409 }
      )
    }

    const result = await db.query(
      `INSERT INTO social_accounts (owner_id, username, email, full_name)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [user.id, username, email, full_name]
    )

    return new Response(JSON.stringify({ account: result.rows[0] }), { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}

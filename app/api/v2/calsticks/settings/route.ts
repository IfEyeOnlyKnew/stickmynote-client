// v2 Calsticks Settings API: production-quality, manage calstick user settings
import { type NextRequest } from 'next/server'
import { db } from '@/lib/database/pg-client'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { handleApiError } from '@/lib/api/handle-api-error'

export const dynamic = 'force-dynamic'

// GET /api/v2/calsticks/settings - Get user's calstick settings
export async function GET() {
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
      `SELECT calstick_auto_archive_days FROM users WHERE id = $1`,
      [user.id]
    )

    return new Response(
      JSON.stringify({ autoArchiveDays: result.rows[0]?.calstick_auto_archive_days ?? 14 }),
      { status: 200 }
    )
  } catch (error) {
    return handleApiError(error)
  }
}

// PATCH /api/v2/calsticks/settings - Update user's calstick settings
export async function PATCH(request: NextRequest) {
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
    const { autoArchiveDays } = body

    if (typeof autoArchiveDays !== 'number' || autoArchiveDays < 0 || autoArchiveDays > 365) {
      return new Response(JSON.stringify({ error: 'Invalid autoArchiveDays value' }), {
        status: 400,
      })
    }

    await db.query(`UPDATE users SET calstick_auto_archive_days = $1 WHERE id = $2`, [
      autoArchiveDays,
      user.id,
    ])

    return new Response(JSON.stringify({ success: true, autoArchiveDays }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

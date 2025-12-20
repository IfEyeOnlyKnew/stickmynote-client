// v2 Time Entries Active API: production-quality, get active timer
import { type NextRequest } from 'next/server'
import { db } from '@/lib/database/pg-client'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { handleApiError } from '@/lib/api/handle-api-error'

export const dynamic = 'force-dynamic'

// GET /api/v2/time-entries/active - Get user's active timer
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
    const taskId = searchParams.get('taskId')

    let query = `SELECT * FROM time_entries WHERE user_id = $1 AND ended_at IS NULL`
    const params: any[] = [user.id]

    if (taskId) {
      query += ` AND task_id = $2`
      params.push(taskId)
    }

    query += ` LIMIT 1`

    const result = await db.query(query, params)

    return new Response(
      JSON.stringify({
        activeEntry: result.rows[0] || null,
        tableExists: true,
      }),
      { status: 200 }
    )
  } catch (error: any) {
    if (error?.code === '42P01' || error?.message?.includes('does not exist')) {
      return new Response(
        JSON.stringify({ activeEntry: null, tableExists: false }),
        { status: 200 }
      )
    }
    return handleApiError(error)
  }
}

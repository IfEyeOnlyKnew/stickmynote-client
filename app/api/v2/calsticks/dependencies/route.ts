// v2 Calsticks Dependencies API: production-quality, manage task dependencies
import { type NextRequest } from 'next/server'
import { db } from '@/lib/database/pg-client'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { handleApiError } from '@/lib/api/handle-api-error'

export const dynamic = 'force-dynamic'

// POST /api/v2/calsticks/dependencies - Get dependencies for tasks
export async function POST(request: NextRequest) {
  try {
    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) {
      return new Response(JSON.stringify({ error: 'Rate limited' }), {
        status: 429,
        headers: { 'Retry-After': '30' },
      })
    }
    if (!authResult.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }

    const body = await request.json()
    const { taskIds } = body

    if (!Array.isArray(taskIds) || taskIds.length === 0) {
      return new Response(JSON.stringify({ dependencies: [] }), { status: 200 })
    }

    const result = await db.query(
      `SELECT * FROM calstick_dependencies WHERE task_id = ANY($1)`,
      [taskIds]
    )

    return new Response(JSON.stringify({ dependencies: result.rows }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

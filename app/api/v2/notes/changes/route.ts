// Delta sync endpoint: returns notes changed since a given timestamp + deleted note IDs
import { type NextRequest } from 'next/server'
import { db } from '@/lib/database/pg-client'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { handleApiError } from '@/lib/api/handle-api-error'

export const dynamic = 'force-dynamic'

// GET /api/v2/notes/changes?since=<ISO timestamp>
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

    const url = new URL(request.url)
    const since = url.searchParams.get('since')

    if (!since) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameter: since' }),
        { status: 400 }
      )
    }

    const sinceDate = new Date(since)
    if (isNaN(sinceDate.getTime())) {
      return new Response(
        JSON.stringify({ error: 'Invalid date format for since parameter' }),
        { status: 400 }
      )
    }

    // Get notes created or updated since the given timestamp
    const updatedResult = await db.query(
      `SELECT * FROM personal_sticks
       WHERE user_id = $1 AND updated_at > $2
       ORDER BY updated_at DESC`,
      [user.id, sinceDate.toISOString()]
    )

    // Get note IDs deleted since the given timestamp
    let deletedIds: string[] = []
    try {
      const deletedResult = await db.query(
        `SELECT note_id FROM note_deletions
         WHERE user_id = $1 AND deleted_at > $2`,
        [user.id, sinceDate.toISOString()]
      )
      deletedIds = deletedResult.rows.map((r: any) => r.note_id)
    } catch {
      // Table may not exist yet if migration hasn't been run — gracefully skip
    }

    return new Response(
      JSON.stringify({
        updated: updatedResult.rows,
        deleted: deletedIds,
        serverTime: new Date().toISOString(),
      }),
      { status: 200 }
    )
  } catch (error) {
    return handleApiError(error)
  }
}

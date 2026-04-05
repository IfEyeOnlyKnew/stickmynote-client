// v2 Notes View Count API: production-quality, get unique view count
import { type NextRequest } from 'next/server'
import { db } from '@/lib/database/pg-client'
import { handleApiError } from '@/lib/api/handle-api-error'

export const dynamic = 'force-dynamic'

// GET /api/v2/notes/[id]/view-count - Get unique view count
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: noteId } = await params

    // Count unique user views
    const result = await db.query(
      `SELECT COUNT(DISTINCT user_id) as count
       FROM personal_sticks_activities
       WHERE personal_stick_id = $1 AND activity_type = 'view'`,
      [noteId]
    )

    const count = Number.parseInt(result.rows[0]?.count || '0', 10)

    return new Response(JSON.stringify({ count }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

// v2 Notes Bookmark API: production-quality, toggle bookmark status
import { type NextRequest } from 'next/server'
import { db } from '@/lib/database/pg-client'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { getOrgContext } from '@/lib/auth/get-org-context'
import { handleApiError } from '@/lib/api/handle-api-error'

export const dynamic = 'force-dynamic'

// GET /api/v2/notes/[id]/bookmark - Get bookmark status
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: noteId } = await params

    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) {
      return new Response(JSON.stringify({ isBookmarked: false }), { status: 200 })
    }
    if (!authResult.user) {
      return new Response(JSON.stringify({ isBookmarked: false }), { status: 200 })
    }
    const user = authResult.user

    const orgContext = await getOrgContext()
    if (!orgContext) {
      return new Response(JSON.stringify({ isBookmarked: false }), { status: 200 })
    }

    const result = await db.query(
      `SELECT id FROM personal_sticks_reactions
       WHERE personal_stick_id = $1 AND user_id = $2 AND reaction_type = 'bookmark'`,
      [noteId, user.id]
    )

    return new Response(
      JSON.stringify({ isBookmarked: result.rows.length > 0 }),
      { status: 200 }
    )
  } catch (error) {
    return handleApiError(error)
  }
}

// POST /api/v2/notes/[id]/bookmark - Toggle bookmark
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: noteId } = await params

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

    const orgContext = await getOrgContext()
    if (!orgContext) {
      return new Response(JSON.stringify({ error: 'Organization context required' }), { status: 403 })
    }

    // Check note exists in org
    const noteResult = await db.query(
      `SELECT id FROM personal_sticks WHERE id = $1 AND org_id = $2`,
      [noteId, orgContext.orgId]
    )

    if (noteResult.rows.length === 0) {
      return new Response(JSON.stringify({ error: 'Note not found' }), { status: 404 })
    }

    // Check existing bookmark
    const existingResult = await db.query(
      `SELECT id FROM personal_sticks_reactions
       WHERE personal_stick_id = $1 AND user_id = $2 AND reaction_type = 'bookmark'`,
      [noteId, user.id]
    )

    if (existingResult.rows.length > 0) {
      // Remove bookmark
      await db.query(
        `DELETE FROM personal_sticks_reactions WHERE id = $1`,
        [existingResult.rows[0].id]
      )
      return new Response(JSON.stringify({ success: true, bookmarked: false }), { status: 200 })
    } else {
      // Add bookmark
      await db.query(
        `INSERT INTO personal_sticks_reactions (personal_stick_id, user_id, reaction_type)
         VALUES ($1, $2, 'bookmark')`,
        [noteId, user.id]
      )
      return new Response(JSON.stringify({ success: true, bookmarked: true }), { status: 200 })
    }
  } catch (error) {
    return handleApiError(error)
  }
}

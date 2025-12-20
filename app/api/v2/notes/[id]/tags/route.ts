// v2 Notes Tags API: production-quality, get note with tags
import { type NextRequest } from 'next/server'
import { db } from '@/lib/database/pg-client'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { handleApiError } from '@/lib/api/handle-api-error'

export const dynamic = 'force-dynamic'

// GET /api/v2/notes/[id]/tags - Get note with its tags
export async function GET(
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

    // Get note (personal_sticks table)
    const noteResult = await db.query(
      `SELECT * FROM personal_sticks WHERE id = $1 AND user_id = $2`,
      [noteId, user.id]
    )

    if (noteResult.rows.length === 0) {
      return new Response(JSON.stringify({ error: 'Note not found' }), { status: 404 })
    }

    // Get tags from personal_sticks_tags table
    const tagsResult = await db.query(
      `SELECT id, tag_title, tag_order, created_at
       FROM personal_sticks_tags
       WHERE personal_stick_id = $1
       ORDER BY tag_order ASC`,
      [noteId]
    )

    return new Response(
      JSON.stringify({
        note: noteResult.rows[0],
        tags: tagsResult.rows,
      }),
      { status: 200 }
    )
  } catch (error) {
    return handleApiError(error)
  }
}

// POST /api/v2/notes/[id]/tags - Add tag to note
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

    const body = await request.json()
    const { tag_title } = body

    if (!tag_title?.trim()) {
      return new Response(JSON.stringify({ error: 'Tag title is required' }), { status: 400 })
    }

    // Check note ownership
    const noteResult = await db.query(
      `SELECT id FROM personal_sticks WHERE id = $1 AND user_id = $2`,
      [noteId, user.id]
    )

    if (noteResult.rows.length === 0) {
      return new Response(JSON.stringify({ error: 'Note not found' }), { status: 404 })
    }

    // Get max order
    const orderResult = await db.query(
      `SELECT COALESCE(MAX(tag_order), 0) + 1 as next_order FROM personal_sticks_tags WHERE personal_stick_id = $1`,
      [noteId]
    )
    const nextOrder = orderResult.rows[0]?.next_order || 1

    // Insert tag
    const insertResult = await db.query(
      `INSERT INTO personal_sticks_tags (personal_stick_id, tag_title, tag_order)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [noteId, tag_title.trim(), nextOrder]
    )

    return new Response(JSON.stringify({ tag: insertResult.rows[0] }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

// DELETE /api/v2/notes/[id]/tags - Remove tag from note
export async function DELETE(
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

    const body = await request.json()
    const { tagId, tag_title } = body

    // Check note ownership
    const noteResult = await db.query(
      `SELECT id FROM personal_sticks WHERE id = $1 AND user_id = $2`,
      [noteId, user.id]
    )

    if (noteResult.rows.length === 0) {
      return new Response(JSON.stringify({ error: 'Note not found' }), { status: 404 })
    }

    // Delete by ID or title
    if (tagId) {
      await db.query(
        `DELETE FROM personal_sticks_tags WHERE id = $1 AND personal_stick_id = $2`,
        [tagId, noteId]
      )
    } else if (tag_title) {
      await db.query(
        `DELETE FROM personal_sticks_tags WHERE tag_title = $1 AND personal_stick_id = $2`,
        [tag_title, noteId]
      )
    } else {
      return new Response(JSON.stringify({ error: 'Tag ID or title is required' }), { status: 400 })
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

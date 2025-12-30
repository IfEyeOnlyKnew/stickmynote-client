// v2 Note Tabs API: production-quality, CRUD operations for note tabs
import { type NextRequest } from 'next/server'
import { db } from '@/lib/database/pg-client'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { handleApiError } from '@/lib/api/handle-api-error'

export const dynamic = 'force-dynamic'

// GET /api/v2/notes/[id]/tabs - Get all tabs for a note
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

    // Verify note belongs to user
    const noteResult = await db.query(
      `SELECT id FROM personal_sticks WHERE id = $1 AND user_id = $2`,
      [noteId, user.id]
    )

    if (noteResult.rows.length === 0) {
      return new Response(JSON.stringify({ error: 'Note not found' }), { status: 404 })
    }

    // Get all tabs for this note
    const tabsResult = await db.query(
      `SELECT id, personal_stick_id, user_id, tab_type, tab_name, tab_content, tab_data, tab_order, created_at, updated_at
       FROM personal_sticks_tabs
       WHERE personal_stick_id = $1 AND user_id = $2
       ORDER BY tab_order ASC`,
      [noteId, user.id]
    )

    return new Response(JSON.stringify({ tabs: tabsResult.rows }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

// POST /api/v2/notes/[id]/tabs - Create a new tab for a note
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

    // Verify note belongs to user
    const noteResult = await db.query(
      `SELECT id FROM personal_sticks WHERE id = $1 AND user_id = $2`,
      [noteId, user.id]
    )

    if (noteResult.rows.length === 0) {
      return new Response(JSON.stringify({ error: 'Note not found' }), { status: 404 })
    }

    const body = await request.json()
    const { tab_type, tab_name, tab_content, tab_data, tab_order } = body

    // Get the next tab order if not provided
    let order = tab_order
    if (order === undefined || order === null) {
      const maxOrderResult = await db.query(
        `SELECT COALESCE(MAX(tab_order), 0) as max_order FROM personal_sticks_tabs WHERE personal_stick_id = $1`,
        [noteId]
      )
      order = (maxOrderResult.rows[0]?.max_order || 0) + 1
    }

    const result = await db.query(
      `INSERT INTO personal_sticks_tabs
       (personal_stick_id, user_id, tab_type, tab_name, tab_content, tab_data, tab_order, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
       RETURNING *`,
      [noteId, user.id, tab_type || 'main', tab_name || 'Main', tab_content || '', JSON.stringify(tab_data || {}), order]
    )

    return new Response(JSON.stringify({ tab: result.rows[0] }), { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}

// PUT /api/v2/notes/[id]/tabs - Bulk update tabs for a note
export async function PUT(
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

    // Verify note belongs to user
    const noteResult = await db.query(
      `SELECT id FROM personal_sticks WHERE id = $1 AND user_id = $2`,
      [noteId, user.id]
    )

    if (noteResult.rows.length === 0) {
      return new Response(JSON.stringify({ error: 'Note not found' }), { status: 404 })
    }

    const body = await request.json()
    const { tabs } = body

    if (!Array.isArray(tabs)) {
      return new Response(JSON.stringify({ error: 'tabs must be an array' }), { status: 400 })
    }

    // Delete existing tabs and insert new ones
    await db.query(
      `DELETE FROM personal_sticks_tabs WHERE personal_stick_id = $1 AND user_id = $2`,
      [noteId, user.id]
    )

    const insertedTabs: any[] = []
    for (let i = 0; i < tabs.length; i++) {
      const tab = tabs[i]
      const result = await db.query(
        `INSERT INTO personal_sticks_tabs
         (personal_stick_id, user_id, tab_type, tab_name, tab_content, tab_data, tab_order, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
         RETURNING *`,
        [noteId, user.id, tab.tab_type || 'main', tab.tab_name || 'Tab', tab.tab_content || '', JSON.stringify(tab.tab_data || {}), i + 1]
      )
      if (result.rows[0]) insertedTabs.push(result.rows[0])
    }

    return new Response(JSON.stringify({ tabs: insertedTabs }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

// DELETE /api/v2/notes/[id]/tabs - Delete all tabs for a note
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

    // Verify note belongs to user
    const noteResult = await db.query(
      `SELECT id FROM personal_sticks WHERE id = $1 AND user_id = $2`,
      [noteId, user.id]
    )

    if (noteResult.rows.length === 0) {
      return new Response(JSON.stringify({ error: 'Note not found' }), { status: 404 })
    }

    await db.query(
      `DELETE FROM personal_sticks_tabs WHERE personal_stick_id = $1 AND user_id = $2`,
      [noteId, user.id]
    )

    return new Response(JSON.stringify({ success: true }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

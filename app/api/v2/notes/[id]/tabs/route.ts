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

    // Verify note belongs to user OR is shared (for /panel community notes)
    const noteResult = await db.query(
      `SELECT id, user_id FROM personal_sticks WHERE id = $1 AND (user_id = $2 OR is_shared = true)`,
      [noteId, user.id]
    )

    if (noteResult.rows.length === 0) {
      return new Response(JSON.stringify({ error: 'Note not found' }), { status: 404 })
    }

    const noteOwnerId = noteResult.rows[0].user_id

    // Get all tabs for this note (owned by the note owner)
    const tabsResult = await db.query(
      `SELECT id, personal_stick_id, user_id, tab_type, tab_name, tab_content, tab_data, tab_order, created_at, updated_at
       FROM personal_sticks_tabs
       WHERE personal_stick_id = $1 AND user_id = $2
       ORDER BY tab_order ASC`,
      [noteId, noteOwnerId]
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
    // Support both camelCase (from client) and snake_case (legacy)
    const tabType = body.tabType || body.tab_type
    const tabName = body.tab_name
    const tabContent = body.tab_content
    const tabData = body.data || body.tab_data
    const tabOrder = body.tab_order

    // Handle videos/images merge operation from useMediaUploadBase
    if ((tabType === 'videos' || tabType === 'video' || tabType === 'images') && tabData) {
      // Check if tab already exists
      const existingTab = await db.query(
        `SELECT id, tab_data FROM personal_sticks_tabs
         WHERE personal_stick_id = $1 AND user_id = $2 AND tab_type = $3
         LIMIT 1`,
        [noteId, user.id, tabType === 'video' ? 'video' : tabType]
      )

      if (existingTab.rows.length > 0) {
        // Update existing tab by merging data
        const existingData = existingTab.rows[0].tab_data || {}
        const mergedData = {
          ...existingData,
          ...tabData
        }

        await db.query(
          `UPDATE personal_sticks_tabs
           SET tab_data = $1, updated_at = NOW()
           WHERE id = $2`,
          [JSON.stringify(mergedData), existingTab.rows[0].id]
        )

        return new Response(JSON.stringify({ success: true, updated: true }), { status: 200 })
      }
    }

    // Get the next tab order if not provided
    let order = tabOrder
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
      [noteId, user.id, tabType || 'main', tabName || 'Main', tabContent || '', JSON.stringify(tabData || {}), order]
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

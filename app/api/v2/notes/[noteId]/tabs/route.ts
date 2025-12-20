// v2 Note Tabs API: CRUD operations for note tabs
import { NextRequest, NextResponse } from 'next/server'
import { requireADSession } from '@/lib/auth/ad-session'
import { queryMany, queryOne, execute } from '@/lib/database/pg-client'
import { handleApiError } from '@/lib/api/handle-api-error'

// GET /api/v2/notes/[noteId]/tabs - Get all tabs for a note
export async function GET(request: NextRequest, { params }: { params: { noteId: string } }) {
  try {
    const session = await requireADSession(request)
    const userId = session.user.id
    const noteId = params.noteId

    // First verify the note belongs to this user
    const note = await queryOne(
      `SELECT id FROM personal_sticks WHERE id = $1 AND user_id = $2`,
      [noteId, userId]
    )

    if (!note) {
      return NextResponse.json({ error: 'Note not found or access denied' }, { status: 404 })
    }

    // Get all tabs for this note
    const tabs = await queryMany(
      `SELECT id, personal_stick_id, user_id, tab_type, tab_name, tab_content, tab_data, tab_order, created_at, updated_at
       FROM personal_sticks_tabs 
       WHERE personal_stick_id = $1 AND user_id = $2
       ORDER BY tab_order ASC`,
      [noteId, userId]
    )

    return NextResponse.json({ tabs: tabs || [] }, { status: 200 })
  } catch (error) {
    console.error('[API] GET /api/v2/notes/[noteId]/tabs error:', error)
    return handleApiError(error)
  }
}

// POST /api/v2/notes/[noteId]/tabs - Create a new tab for a note
export async function POST(request: NextRequest, { params }: { params: { noteId: string } }) {
  try {
    const session = await requireADSession(request)
    const userId = session.user.id
    const noteId = params.noteId

    // First verify the note belongs to this user
    const note = await queryOne(
      `SELECT id FROM personal_sticks WHERE id = $1 AND user_id = $2`,
      [noteId, userId]
    )

    if (!note) {
      return NextResponse.json({ error: 'Note not found or access denied' }, { status: 404 })
    }

    const body = await request.json()
    const { tab_type, tab_name, tab_content, tab_data, tab_order } = body

    // Get the next tab order if not provided
    let order = tab_order
    if (order === undefined || order === null) {
      const maxOrderResult = await queryOne<{ max_order: number }>(
        `SELECT COALESCE(MAX(tab_order), 0) as max_order FROM personal_sticks_tabs WHERE personal_stick_id = $1`,
        [noteId]
      )
      order = (maxOrderResult?.max_order || 0) + 1
    }

    const tab = await queryOne(
      `INSERT INTO personal_sticks_tabs 
       (personal_stick_id, user_id, tab_type, tab_name, tab_content, tab_data, tab_order, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
       RETURNING *`,
      [noteId, userId, tab_type || 'main', tab_name || 'Main', tab_content || '', JSON.stringify(tab_data || {}), order]
    )

    return NextResponse.json({ tab }, { status: 201 })
  } catch (error) {
    console.error('[API] POST /api/v2/notes/[noteId]/tabs error:', error)
    return handleApiError(error)
  }
}

// PUT /api/v2/notes/[noteId]/tabs - Bulk update tabs for a note
export async function PUT(request: NextRequest, { params }: { params: { noteId: string } }) {
  try {
    const session = await requireADSession(request)
    const userId = session.user.id
    const noteId = params.noteId

    // First verify the note belongs to this user
    const note = await queryOne(
      `SELECT id FROM personal_sticks WHERE id = $1 AND user_id = $2`,
      [noteId, userId]
    )

    if (!note) {
      return NextResponse.json({ error: 'Note not found or access denied' }, { status: 404 })
    }

    const body = await request.json()
    const { tabs } = body

    if (!Array.isArray(tabs)) {
      return NextResponse.json({ error: 'tabs must be an array' }, { status: 400 })
    }

    // Delete existing tabs and insert new ones (simple approach)
    await execute(
      `DELETE FROM personal_sticks_tabs WHERE personal_stick_id = $1 AND user_id = $2`,
      [noteId, userId]
    )

    const insertedTabs: any[] = []
    for (let i = 0; i < tabs.length; i++) {
      const tab = tabs[i]
      const inserted = await queryOne(
        `INSERT INTO personal_sticks_tabs 
         (personal_stick_id, user_id, tab_type, tab_name, tab_content, tab_data, tab_order, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
         RETURNING *`,
        [noteId, userId, tab.tab_type || 'main', tab.tab_name || 'Tab', tab.tab_content || '', JSON.stringify(tab.tab_data || {}), i + 1]
      )
      if (inserted) insertedTabs.push(inserted)
    }

    return NextResponse.json({ tabs: insertedTabs }, { status: 200 })
  } catch (error) {
    console.error('[API] PUT /api/v2/notes/[noteId]/tabs error:', error)
    return handleApiError(error)
  }
}

// DELETE /api/v2/notes/[noteId]/tabs - Delete all tabs for a note
export async function DELETE(request: NextRequest, { params }: { params: { noteId: string } }) {
  try {
    const session = await requireADSession(request)
    const userId = session.user.id
    const noteId = params.noteId

    // First verify the note belongs to this user
    const note = await queryOne(
      `SELECT id FROM personal_sticks WHERE id = $1 AND user_id = $2`,
      [noteId, userId]
    )

    if (!note) {
      return NextResponse.json({ error: 'Note not found or access denied' }, { status: 404 })
    }

    await execute(
      `DELETE FROM personal_sticks_tabs WHERE personal_stick_id = $1 AND user_id = $2`,
      [noteId, userId]
    )

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error('[API] DELETE /api/v2/notes/[noteId]/tabs error:', error)
    return handleApiError(error)
  }
}

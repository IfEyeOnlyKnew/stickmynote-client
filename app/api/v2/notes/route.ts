// v2 Notes API: Full CRUD, PostgreSQL + AD
import { NextRequest } from 'next/server'
import { requireADSession } from '@/lib/auth/ad-session'
import { handleApiError } from '@/lib/api/handle-api-error'
import { listNotes, createNote, updateNote, deleteNote } from '@/lib/handlers/notes-handler'

// GET /api/v2/notes - List notes for user/org
export async function GET(request: NextRequest) {
  try {
    const session = await requireADSession(request)
    const url = new URL(request.url)
    const limit = Number(url.searchParams.get('limit') || '50')
    const offset = Number(url.searchParams.get('offset') || '0')
    const result = await listNotes(session, limit, offset)
    return new Response(JSON.stringify(result.body), { status: result.status })
  } catch (error) {
    return handleApiError(error)
  }
}

// POST /api/v2/notes - Create note
export async function POST(request: NextRequest) {
  try {
    const session = await requireADSession(request)
    const body = await request.json()
    const result = await createNote(session, body)
    return new Response(JSON.stringify(result.body), { status: result.status })
  } catch (error) {
    return handleApiError(error)
  }
}

// PUT /api/v2/notes?id=... - Update note
export async function PUT(request: NextRequest) {
  try {
    const session = await requireADSession(request)
    const url = new URL(request.url)
    const noteId = url.searchParams.get('id') || ''
    const body = await request.json()
    const result = await updateNote(session, noteId, body)
    return new Response(JSON.stringify(result.body), { status: result.status })
  } catch (error) {
    return handleApiError(error)
  }
}

// DELETE /api/v2/notes?id=... - Delete note
export async function DELETE(request: NextRequest) {
  try {
    const session = await requireADSession(request)
    const url = new URL(request.url)
    const noteId = url.searchParams.get('id') || ''
    const result = await deleteNote(session, noteId)
    return new Response(JSON.stringify(result.body), { status: result.status })
  } catch (error) {
    return handleApiError(error)
  }
}

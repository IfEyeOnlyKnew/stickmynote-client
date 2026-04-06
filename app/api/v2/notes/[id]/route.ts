// v2 Notes [id] API: production-quality, get, update, delete single note
import { type NextRequest } from 'next/server'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { handleApiError } from '@/lib/api/handle-api-error'
import {
  getNoteWithDetails,
  checkNoteDLP,
  updateNoteFields,
  deleteNoteById,
} from '@/lib/handlers/notes-handler'

export const dynamic = 'force-dynamic'

// ============================================================================
// Auth helper for v2 routes (cached auth + rate limiting)
// ============================================================================

async function authenticateV2() {
  const authResult = await getCachedAuthUser()
  if (authResult.rateLimited) {
    return {
      error: new Response(
        JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }),
        { status: 429, headers: { 'Retry-After': '30' } }
      ),
    }
  }
  if (!authResult.user) {
    return { error: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }) }
  }
  return { user: authResult.user }
}

function broadcastToUser(userId: string, type: string, payload: unknown) {
  const broadcast = (globalThis as any).__wsBroadcast
  broadcast?.sendToUser(userId, { type, payload, timestamp: Date.now() })
}

// GET /api/v2/notes/[id] - Get single note
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: noteId } = await params
    const auth = await authenticateV2()
    if ('error' in auth) return auth.error

    const note = await getNoteWithDetails(noteId, auth.user.id)
    if (!note) {
      return new Response(JSON.stringify({ error: 'Note not found' }), { status: 404 })
    }

    return new Response(JSON.stringify(note), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

// Shared update logic for PUT and PATCH (identical behavior)
async function handleUpdate(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: noteId } = await params
    const auth = await authenticateV2()
    if ('error' in auth) return auth.error

    const body = await request.json()

    const dlp = await checkNoteDLP(noteId, auth.user.id, body)
    if (!dlp.allowed) {
      return new Response(JSON.stringify({ error: dlp.reason }), { status: 403 })
    }

    const result = await updateNoteFields(noteId, auth.user.id, body)
    if (!result) {
      return new Response(JSON.stringify({ error: 'Note not found' }), { status: 404 })
    }

    broadcastToUser(auth.user.id, 'note.updated', result)
    return new Response(JSON.stringify(result), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

// PUT /api/v2/notes/[id] - Full update
export const PUT = handleUpdate

// PATCH /api/v2/notes/[id] - Partial update
export const PATCH = handleUpdate

// DELETE /api/v2/notes/[id] - Delete note
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: noteId } = await params
    const auth = await authenticateV2()
    if ('error' in auth) return auth.error

    const { status, body, deletedId } = await deleteNoteById(noteId, auth.user.id)
    if (deletedId) {
      broadcastToUser(auth.user.id, 'note.deleted', { id: deletedId })
    }

    return new Response(JSON.stringify(body), { status })
  } catch (error) {
    return handleApiError(error)
  }
}

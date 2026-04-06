// v2 Notes Tags API: production-quality, get note with tags
import { type NextRequest } from 'next/server'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { handleApiError } from '@/lib/api/handle-api-error'
import { getNoteWithTags, addNoteTag, removeNoteTag } from '@/lib/handlers/notes-tags-handler'
import { toResponse, rateLimitResponse, unauthorizedResponse } from '@/lib/handlers/inference-response'

export const dynamic = 'force-dynamic'

// GET /api/v2/notes/[id]/tags - Get note with its tags
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: noteId } = await params

    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) return rateLimitResponse()
    if (!authResult.user) return unauthorizedResponse()

    const result = await getNoteWithTags(noteId, authResult.user.id)
    return toResponse(result)
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
    if (authResult.rateLimited) return rateLimitResponse()
    if (!authResult.user) return unauthorizedResponse()

    const body = await request.json()
    const { tag_title } = body

    if (!tag_title?.trim()) {
      return new Response(JSON.stringify({ error: 'Tag title is required' }), { status: 400 })
    }

    const result = await addNoteTag(noteId, authResult.user.id, tag_title)
    return toResponse(result)
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
    if (authResult.rateLimited) return rateLimitResponse()
    if (!authResult.user) return unauthorizedResponse()

    const body = await request.json()
    const result = await removeNoteTag(noteId, authResult.user.id, { tagId: body.tagId, tagTitle: body.tag_title })
    return toResponse(result)
  } catch (error) {
    return handleApiError(error)
  }
}

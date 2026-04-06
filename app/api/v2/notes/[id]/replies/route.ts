// v2 Notes Replies API: production-quality, manage note replies
import { type NextRequest } from 'next/server'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { getOrgContext } from '@/lib/auth/get-org-context'
import { handleApiError } from '@/lib/api/handle-api-error'
import {
  getRepliesForNote,
  createReplyOnNote,
  updateReplyOnNote,
  deleteReplyOnNote,
} from '@/lib/handlers/notes-replies-handler'

export const dynamic = 'force-dynamic'

// ============================================================================
// Auth helper for v2 routes
// ============================================================================

async function authenticateWithOrg(): Promise<
  | { error: Response }
  | { user: { id: string; email?: string }; orgId: string }
> {
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

  const orgContext = await getOrgContext()
  if (!orgContext) {
    return { error: new Response(JSON.stringify({ error: 'Organization context required' }), { status: 403 }) }
  }

  return { user: authResult.user, orgId: orgContext.orgId }
}

// GET /api/v2/notes/[id]/replies - Get replies
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: noteId } = await params

    // For private note checks, get user ID if authenticated
    let userId: string | undefined
    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }),
        { status: 429, headers: { 'Retry-After': '30' } }
      )
    }
    userId = authResult.user?.id

    const { status, body } = await getRepliesForNote(noteId, userId)
    return new Response(JSON.stringify(body), { status })
  } catch (error) {
    return handleApiError(error)
  }
}

// POST /api/v2/notes/[id]/replies - Create reply
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: noteId } = await params
    const auth = await authenticateWithOrg()
    if ('error' in auth) return auth.error

    const body = await request.json()
    const { content, color } = body

    const result = await createReplyOnNote(noteId, {
      user: auth.user,
      orgId: auth.orgId,
    }, { content, color })

    return new Response(JSON.stringify(result.body), { status: result.status })
  } catch (error) {
    return handleApiError(error)
  }
}

// PUT /api/v2/notes/[id]/replies - Update reply
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateWithOrg()
    if ('error' in auth) return auth.error

    const body = await request.json()
    const { replyId, content, color } = body

    const result = await updateReplyOnNote(
      { user: auth.user, orgId: auth.orgId },
      { replyId, content, color }
    )

    return new Response(JSON.stringify(result.body), { status: result.status })
  } catch (error) {
    return handleApiError(error)
  }
}

// DELETE /api/v2/notes/[id]/replies - Delete reply
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateWithOrg()
    if ('error' in auth) return auth.error

    const body = await request.json()
    const { replyId } = body

    const result = await deleteReplyOnNote(
      { user: auth.user, orgId: auth.orgId },
      replyId
    )

    return new Response(JSON.stringify(result.body), { status: result.status })
  } catch (error) {
    return handleApiError(error)
  }
}

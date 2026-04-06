// v2 Social Sticks Replies API: thin wrapper over shared handler
import { type NextRequest } from 'next/server'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { getOrgContext } from '@/lib/auth/get-org-context'
import { listReplies, createReply, updateReply, deleteReply } from '@/lib/handlers/inference-sticks-replies-handler'
import { toResponse, rateLimitResponse, unauthorizedResponse, noOrgResponse } from '@/lib/handlers/inference-response'
import { handleApiError } from '@/lib/api/handle-api-error'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ stickId: string }> }
) {
  try {
    const { stickId } = await params
    const orgContext = await getOrgContext()
    return toResponse(await listReplies(stickId, orgContext?.orgId))
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ stickId: string }> }
) {
  try {
    const { stickId } = await params

    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) return rateLimitResponse()
    if (!authResult.user) return unauthorizedResponse()

    const orgContext = await getOrgContext()
    if (!orgContext) return noOrgResponse()

    const body = await request.json()
    return toResponse(await createReply(stickId, body, { user: authResult.user, orgContext }))
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ stickId: string }> }
) {
  try {
    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) return rateLimitResponse()
    if (!authResult.user) return unauthorizedResponse()

    const orgContext = await getOrgContext()
    if (!orgContext) return noOrgResponse()

    const body = await request.json()
    return toResponse(await updateReply(body, { user: authResult.user, orgContext }))
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ stickId: string }> }
) {
  try {
    const { stickId } = await params
    const { searchParams } = new URL(request.url)
    const replyId = searchParams.get('replyId')

    if (!replyId) {
      return toResponse({ status: 400, body: { error: 'Reply ID is required' } })
    }

    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) return rateLimitResponse()
    if (!authResult.user) return unauthorizedResponse()

    const orgContext = await getOrgContext()
    if (!orgContext) return noOrgResponse()

    return toResponse(await deleteReply(stickId, replyId, { user: authResult.user, orgContext }))
  } catch (error) {
    return handleApiError(error)
  }
}

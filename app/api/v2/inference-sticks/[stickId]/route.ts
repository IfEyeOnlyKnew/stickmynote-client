// v2 Social Sticks [stickId] API: thin wrapper over shared handler
import { type NextRequest } from 'next/server'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { getOrgContext } from '@/lib/auth/get-org-context'
import { getStickDetail, updateStickDetail, deleteStickDetail } from '@/lib/handlers/inference-sticks-detail-handler'
import { toResponse, rateLimitResponse, unauthorizedResponse, noOrgResponse, errorResponse } from '@/lib/handlers/inference-response'
import { handleApiError } from '@/lib/api/handle-api-error'

export const dynamic = 'force-dynamic'

async function getAuthContext() {
  const authResult = await getCachedAuthUser()
  if (authResult.rateLimited) return { error: rateLimitResponse() }
  if (!authResult.user) return { error: unauthorizedResponse() }

  const orgContext = await getOrgContext()
  if (!orgContext) return { error: noOrgResponse() }

  return { context: { user: authResult.user, orgContext } }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ stickId: string }> }
) {
  try {
    const { stickId } = await params
    const auth = await getAuthContext()
    if ('error' in auth) return auth.error

    return toResponse(await getStickDetail(stickId, auth.context))
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ stickId: string }> }
) {
  try {
    const { stickId } = await params
    const auth = await getAuthContext()
    if ('error' in auth) return auth.error

    const body = await request.json()
    return toResponse(await updateStickDetail(stickId, body, auth.context))
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
    const auth = await getAuthContext()
    if ('error' in auth) return auth.error

    return toResponse(await deleteStickDetail(stickId, auth.context))
  } catch (error) {
    return handleApiError(error)
  }
}

// v2 Social Sticks Media API: production-quality, manage stick media
import { type NextRequest } from 'next/server'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { getOrgContext } from '@/lib/auth/get-org-context'
import { handleApiError } from '@/lib/api/handle-api-error'
import { addMedia, removeMedia } from '@/lib/handlers/inference-sticks-media-handler'
import { toResponse, rateLimitResponse, unauthorizedResponse, noOrgResponse } from '@/lib/handlers/inference-response'

export const dynamic = 'force-dynamic'

// POST /api/v2/inference-sticks/[stickId]/media - Add media
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
    const result = await addMedia(stickId, authResult.user.id, orgContext.orgId, body)
    return toResponse(result)
  } catch (error) {
    return handleApiError(error)
  }
}

// DELETE /api/v2/inference-sticks/[stickId]/media - Remove media
export async function DELETE(
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
    const result = await removeMedia(stickId, authResult.user.id, orgContext.orgId, body.url)
    return toResponse(result)
  } catch (error) {
    return handleApiError(error)
  }
}

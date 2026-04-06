// v2 Social Pads [padId] API: thin wrapper over shared handler
import { type NextRequest } from 'next/server'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { getOrgContext } from '@/lib/auth/get-org-context'
import { isUnderLegalHold } from '@/lib/legal-hold/check-hold'
import { getPadDetail, updatePadDetail, deletePadDetail } from '@/lib/handlers/inference-pads-handler'
import { toResponse, rateLimitResponse, unauthorizedResponse, noOrgResponse } from '@/lib/handlers/inference-response'
import { handleApiError } from '@/lib/api/handle-api-error'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ padId: string }> }
) {
  try {
    const { padId } = await params

    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) return rateLimitResponse()

    const user = authResult.user
    const orgContext = user ? await getOrgContext() : null

    return toResponse(await getPadDetail(padId, user, orgContext))
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ padId: string }> }
) {
  try {
    const { padId } = await params

    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) return rateLimitResponse()
    if (!authResult.user) return unauthorizedResponse()

    const orgContext = await getOrgContext()
    if (!orgContext) return noOrgResponse()

    const body = await request.json()
    return toResponse(await updatePadDetail(padId, body, authResult.user, orgContext))
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ padId: string }> }
) {
  try {
    const { padId } = await params

    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) return rateLimitResponse()
    if (!authResult.user) return unauthorizedResponse()

    const orgContext = await getOrgContext()
    if (!orgContext) return noOrgResponse()

    return toResponse(await deletePadDetail(padId, authResult.user, orgContext))
  } catch (error) {
    return handleApiError(error)
  }
}

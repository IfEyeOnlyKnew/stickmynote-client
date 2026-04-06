// v2 Social Sticks Pin API: production-quality, toggle and reorder pins
import { type NextRequest } from 'next/server'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { getOrgContext } from '@/lib/auth/get-org-context'
import { handleApiError } from '@/lib/api/handle-api-error'
import { togglePin, reorderPin } from '@/lib/handlers/inference-sticks-pin-handler'
import { toResponse, rateLimitResponse, unauthorizedResponse, noOrgResponse } from '@/lib/handlers/inference-response'

export const dynamic = 'force-dynamic'

// POST /api/v2/inference-sticks/[stickId]/pin - Toggle pin
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

    const result = await togglePin(stickId, authResult.user.id, orgContext.orgId)
    return toResponse(result)
  } catch (error) {
    return handleApiError(error)
  }
}

// PUT /api/v2/inference-sticks/[stickId]/pin - Reorder pinned stick
export async function PUT(
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
    const result = await reorderPin(stickId, authResult.user.id, orgContext.orgId, body.pin_order)
    return toResponse(result)
  } catch (error) {
    return handleApiError(error)
  }
}

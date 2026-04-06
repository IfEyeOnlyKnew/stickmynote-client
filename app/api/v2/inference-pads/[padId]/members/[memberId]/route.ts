// v2 Social Pads Member [memberId] API: production-quality, manage individual member
import { type NextRequest } from 'next/server'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { handleApiError } from '@/lib/api/handle-api-error'
import { updateMemberAdminLevel, removeMember } from '@/lib/handlers/inference-pads-member-handler'
import { toResponse, rateLimitResponse, unauthorizedResponse } from '@/lib/handlers/inference-response'

export const dynamic = 'force-dynamic'

// PATCH /api/v2/inference-pads/[padId]/members/[memberId] - Update member admin level
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ padId: string; memberId: string }> }
) {
  try {
    const { padId, memberId } = await params

    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) return rateLimitResponse()
    if (!authResult.user) return unauthorizedResponse()

    const body = await request.json()
    const result = await updateMemberAdminLevel(padId, memberId, authResult.user.id, body.admin_level)
    return toResponse(result)
  } catch (error) {
    return handleApiError(error)
  }
}

// DELETE /api/v2/inference-pads/[padId]/members/[memberId] - Remove member
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ padId: string; memberId: string }> }
) {
  try {
    const { padId, memberId } = await params

    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) return rateLimitResponse()
    if (!authResult.user) return unauthorizedResponse()

    const result = await removeMember(padId, memberId, authResult.user.id)
    return toResponse(result)
  } catch (error) {
    return handleApiError(error)
  }
}

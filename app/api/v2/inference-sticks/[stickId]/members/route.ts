// v2 Social Sticks Members API: thin wrapper over shared handler
import { type NextRequest } from 'next/server'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { listStickMembers, addStickMember } from '@/lib/handlers/inference-sticks-members-handler'
import { toResponse, rateLimitResponse, unauthorizedResponse } from '@/lib/handlers/inference-response'
import { handleApiError } from '@/lib/api/handle-api-error'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ stickId: string }> }
) {
  try {
    const { stickId } = await params

    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) return rateLimitResponse()
    if (!authResult.user) return unauthorizedResponse()

    return toResponse(await listStickMembers(stickId, authResult.user.id))
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

    const body = await request.json()
    return toResponse(await addStickMember(stickId, body.email, authResult.user.id))
  } catch (error) {
    return handleApiError(error)
  }
}

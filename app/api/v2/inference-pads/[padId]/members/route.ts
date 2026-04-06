// v2 Social Pads Members API: thin wrapper over shared handler
import { type NextRequest } from 'next/server'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { getOrgContext } from '@/lib/auth/get-org-context'
import { listPadMembers, addPadMember, updatePadMember, removePadMember } from '@/lib/handlers/inference-pads-members-handler'
import { toResponse, rateLimitResponse, unauthorizedResponse, noOrgResponse } from '@/lib/handlers/inference-response'
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
  { params }: { params: Promise<{ padId: string }> }
) {
  try {
    const { padId } = await params
    const auth = await getAuthContext()
    if ('error' in auth) return auth.error

    return toResponse(await listPadMembers(padId, auth.context))
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ padId: string }> }
) {
  try {
    const { padId } = await params
    const auth = await getAuthContext()
    if ('error' in auth) return auth.error

    const body = await request.json()
    return toResponse(await addPadMember(padId, body.email, body.role, auth.context))
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
    const auth = await getAuthContext()
    if ('error' in auth) return auth.error

    const body = await request.json()
    return toResponse(await updatePadMember(padId, body, auth.context))
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
    const auth = await getAuthContext()
    if ('error' in auth) return auth.error

    const { searchParams } = new URL(request.url)
    const memberId = searchParams.get('memberId')

    if (!memberId) {
      return toResponse({ status: 400, body: { error: 'Member ID is required' } })
    }

    return toResponse(await removePadMember(padId, memberId, auth.context))
  } catch (error) {
    return handleApiError(error)
  }
}

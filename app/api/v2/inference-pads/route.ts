// v2 Social Pads API: thin wrapper over shared handler
import { type NextRequest } from 'next/server'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { getOrgContext } from '@/lib/auth/get-org-context'
import { listPads, createPad } from '@/lib/handlers/inference-pads-handler'
import { toResponse, rateLimitResponse, unauthorizedResponse, noOrgResponse } from '@/lib/handlers/inference-response'
import { handleApiError } from '@/lib/api/handle-api-error'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) return rateLimitResponse()

    const user = authResult.user
    const orgContext = user ? await getOrgContext() : null

    const result = await listPads(
      {
        isPublic: searchParams.get('public') === 'true',
        isAdmin: searchParams.get('admin') === 'true',
        isPrivate: searchParams.get('private') === 'true',
      },
      user,
      orgContext
    )

    return toResponse(result)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) return rateLimitResponse()
    if (!authResult.user) return unauthorizedResponse()

    const orgContext = await getOrgContext()
    if (!orgContext) return noOrgResponse()

    const body = await request.json()
    return toResponse(await createPad(body, authResult.user, orgContext))
  } catch (error) {
    return handleApiError(error)
  }
}

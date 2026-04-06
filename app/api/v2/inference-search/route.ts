// v2 Social Search API: thin wrapper over shared handler
import { type NextRequest } from 'next/server'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { getOrgContext } from '@/lib/auth/get-org-context'
import { searchSticks, parseSearchParams } from '@/lib/handlers/inference-search-handler'
import { toResponse, rateLimitResponse, unauthorizedResponse, noOrgResponse } from '@/lib/handlers/inference-response'
import { handleApiError } from '@/lib/api/handle-api-error'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) return rateLimitResponse()
    if (!authResult.user) return unauthorizedResponse()

    const orgContext = await getOrgContext()
    if (!orgContext) return noOrgResponse()

    const params = parseSearchParams(request.nextUrl.searchParams)
    return toResponse(await searchSticks(params, authResult.user, orgContext))
  } catch (error) {
    return handleApiError(error)
  }
}

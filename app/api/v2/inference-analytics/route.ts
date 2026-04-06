// v2 Inference Analytics API: thin wrapper over shared handler
import { type NextRequest } from 'next/server'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { getOrgContext } from '@/lib/auth/get-org-context'
import { getAnalytics } from '@/lib/handlers/inference-analytics-handler'
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

    return toResponse(await getAnalytics(authResult.user, orgContext))
  } catch (error) {
    return handleApiError(error)
  }
}

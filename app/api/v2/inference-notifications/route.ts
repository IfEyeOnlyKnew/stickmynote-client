// v2 Social Notifications API: production-quality, get inference notifications
import { type NextRequest } from 'next/server'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { getOrgContext } from '@/lib/auth/get-org-context'
import { handleApiError } from '@/lib/api/handle-api-error'
import { getInferenceNotifications } from '@/lib/handlers/inference-notifications-handler'

export const dynamic = 'force-dynamic'

// GET /api/v2/inference-notifications - Get inference notifications for current user
export async function GET(request: NextRequest) {
  try {
    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }),
        { status: 429, headers: { 'Retry-After': '30' } }
      )
    }
    if (!authResult.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }

    const orgContext = await getOrgContext()
    if (!orgContext) {
      return new Response(JSON.stringify({ error: 'Organization context required' }), { status: 403 })
    }

    const notifications = await getInferenceNotifications(authResult.user.id, orgContext.orgId)

    // v2 limits to 50
    return new Response(
      JSON.stringify({ notifications: notifications.slice(0, 50) }),
      { status: 200 }
    )
  } catch (error) {
    return handleApiError(error)
  }
}

// v2 Digests Send Test API: production-quality, send test digest email
import { type NextRequest } from 'next/server'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { handleApiError } from '@/lib/api/handle-api-error'
import { sendTestDigest } from '@/lib/handlers/digests-handler'

export const dynamic = 'force-dynamic'

// POST /api/v2/digests/send-test - Send test digest email
export async function POST(request: NextRequest) {
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

    const { frequency = 'daily' } = await request.json()

    const result = await sendTestDigest(authResult.user, frequency)

    if (!result.success) {
      const status = result.error === 'No email address found' ? 400 : 500
      return new Response(JSON.stringify({ error: result.error }), { status })
    }

    return new Response(
      JSON.stringify({
        success: true,
        emailId: result.emailId,
        notificationCount: result.notificationCount,
      }),
      { status: 200 }
    )
  } catch (error) {
    return handleApiError(error)
  }
}

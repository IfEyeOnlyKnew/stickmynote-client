// v2 Digests Preview API: production-quality, preview digest email
import { type NextRequest } from 'next/server'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { handleApiError } from '@/lib/api/handle-api-error'
import { previewDigest } from '@/lib/handlers/digests-handler'

export const dynamic = 'force-dynamic'

// GET /api/v2/digests/preview - Preview digest email
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

    const { searchParams } = new URL(request.url)
    const frequency = (searchParams.get('frequency') || 'daily') as 'daily' | 'weekly'

    const html = await previewDigest(authResult.user, frequency)

    return new Response(html, {
      headers: { 'Content-Type': 'text/html' },
    })
  } catch (error) {
    return handleApiError(error)
  }
}

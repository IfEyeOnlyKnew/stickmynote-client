// v2 AI Generate Tags API: production-quality, generate tags from content
import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from '@/lib/auth/cached-auth'
import { GrokService } from '@/lib/ai/grok-service'
import { handleApiError } from '@/lib/api/handle-api-error'

export const dynamic = 'force-dynamic'

// POST /api/v2/ai/generate-tags - Generate tags from content
export async function POST(request: Request) {
  try {
    const { user, error: authError } = await getCachedAuthUser()

    if (authError === 'rate_limited') {
      return createRateLimitResponse()
    }

    if (!user) {
      return createUnauthorizedResponse()
    }

    const { content, topic } = await request.json()

    if (!content) {
      return new Response(JSON.stringify({ error: 'Content is required' }), { status: 400 })
    }

    // Generate tags using Grok
    const tags = await GrokService.generateTags(content, topic)

    return new Response(JSON.stringify({ tags }), { status: 200 })
  } catch (error) {
    if (error instanceof Error && error.message === 'RATE_LIMITED') {
      return createRateLimitResponse()
    }
    return handleApiError(error)
  }
}

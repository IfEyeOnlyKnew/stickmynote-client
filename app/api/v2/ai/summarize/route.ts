// v2 AI Summarize API: production-quality, summarize content
import { AIService } from '@/lib/ai/ai-service'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { handleApiError } from '@/lib/api/handle-api-error'

export const dynamic = 'force-dynamic'

// POST /api/v2/ai/summarize - Summarize content
export async function POST(request: Request) {
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

    const { content, maxLength } = await request.json()

    if (!content) {
      return new Response(JSON.stringify({ error: 'Content is required' }), { status: 400 })
    }

    // Generate summary using configured AI provider (Ollama by default)
    const summary = await AIService.summarizeContent(content, maxLength)

    return new Response(JSON.stringify({ summary }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

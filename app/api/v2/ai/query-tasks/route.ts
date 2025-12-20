// v2 AI Query Tasks API: production-quality, interpret natural language task queries
import { generateText } from 'ai'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { handleApiError } from '@/lib/api/handle-api-error'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

// POST /api/v2/ai/query-tasks - Interpret natural language query for task filtering
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

    const { query } = await request.json()

    if (!query) {
      return new Response(JSON.stringify({ error: 'Query is required' }), { status: 400 })
    }

    // Interpret the natural language query into filter criteria
    const { text } = await generateText({
      model: 'xai/grok-2-1212' as any,
      prompt: `Interpret the following natural language query for filtering tasks and return a JSON object with filter criteria.

      Query: "${query}"

      Possible fields:
      - priority: "urgent", "high", "medium", "low"
      - status: "todo", "in-progress", "review", "done"
      - timeFrame: "overdue", "today", "tomorrow", "this-week", "next-week"
      - isCompleted: boolean
      - search: string (keyword search)

      Return JSON only. Empty object if no filters apply.`,
    })

    let filters = {}
    try {
      const jsonStr = text.replaceAll(/```json\n?|\n?```/g, '').trim()
      filters = JSON.parse(jsonStr)
    } catch (e) {
      console.error('Failed to parse AI response:', text, e)
      return new Response(JSON.stringify({ error: 'Failed to parse query' }), { status: 500 })
    }

    return new Response(JSON.stringify({ filters }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

// v2 AI Generate Subtasks API: production-quality, generate subtasks from task
import { generateText } from 'ai'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { handleApiError } from '@/lib/api/handle-api-error'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

// POST /api/v2/ai/generate-subtasks - Generate subtasks from task content
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

    const { taskContent, parentId } = await request.json()

    if (!taskContent || !parentId) {
      return new Response(
        JSON.stringify({ error: 'Task content and parent ID are required' }),
        { status: 400 }
      )
    }

    const { text } = await generateText({
      model: 'xai/grok-2-1212' as any,
      prompt: `Break down the following task into 3-5 actionable subtasks. Return ONLY a JSON array of strings.

      Task: "${taskContent}"

      Example output: ["Draft initial outline", "Gather research materials", "Review with team"]`,
    })

    let subtasks: string[] = []
    try {
      const jsonStr = text.replaceAll(/```json\n?|\n?```/g, '').trim()
      subtasks = JSON.parse(jsonStr)
    } catch (e) {
      console.error('Failed to parse AI response:', text, e)
      return new Response(JSON.stringify({ error: 'Failed to generate valid subtasks' }), {
        status: 500,
      })
    }

    return new Response(JSON.stringify({ subtasks }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

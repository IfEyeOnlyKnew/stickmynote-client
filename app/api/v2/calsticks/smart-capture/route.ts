// v2 Calsticks Smart Capture API: production-quality, AI-powered task extraction
import { type NextRequest } from 'next/server'
import { generateObject } from 'ai'
import { createXai } from '@ai-sdk/xai'
import { z } from 'zod'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { handleApiError } from '@/lib/api/handle-api-error'

export const dynamic = 'force-dynamic'

const xai = createXai({ apiKey: process.env.XAI_API_KEY })

const tasksSchema = z.object({
  tasks: z.array(
    z.object({
      title: z.string().describe('The task title or description'),
      description: z.string().optional().describe('Additional details about the task'),
      date: z.string().optional().describe('The due date or scheduled date in ISO format'),
      priority: z.enum(['low', 'medium', 'high']).optional().describe('Task priority'),
      tags: z.array(z.string()).optional().describe('Relevant tags or categories'),
      estimatedHours: z.number().optional().describe('Estimated hours to complete'),
    })
  ),
})

// POST /api/v2/calsticks/smart-capture - Parse text and extract tasks
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

    const body = await request.json()
    const { text } = body

    if (!text || typeof text !== 'string') {
      return new Response(JSON.stringify({ error: 'Text is required' }), { status: 400 })
    }

    const { object } = await generateObject({
      model: xai('grok-3-mini') as any,
      schema: tasksSchema,
      prompt: `Parse the following text and extract individual tasks. For each task, identify:
- A clear, concise title
- Any additional description or context
- Due date or scheduled date (convert relative dates like "Friday" or "next week" to actual dates based on today being ${new Date().toISOString()})
- Priority level based on context (high for urgent words like "ASAP", "urgent", medium for default, low for optional)
- Relevant tags or categories
- Estimated hours if mentioned, otherwise infer based on task complexity

Text to parse:
${text}

Return a structured list of tasks. If multiple tasks are mentioned, separate them. Be intelligent about parsing natural language.`,
    })

    return new Response(JSON.stringify({ tasks: object.tasks }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

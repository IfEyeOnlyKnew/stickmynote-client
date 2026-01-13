// v2 Calsticks Auto-Schedule API: production-quality, AI-powered task scheduling
import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { handleApiError } from '@/lib/api/handle-api-error'
import { generateText, isAIAvailable } from '@/lib/ai/ai-provider'

export const dynamic = 'force-dynamic'

const scheduleSchema = z.object({
  schedule: z.array(
    z.object({
      id: z.string(),
      startDate: z.string().describe('Start date and time in ISO format'),
      endDate: z.string().describe('End date and time in ISO format'),
      reasoning: z.string().optional().describe('Why this time slot was chosen'),
    })
  ),
})

// POST /api/v2/calsticks/auto-schedule - Auto-schedule tasks
export async function POST(request: NextRequest) {
  try {
    if (!isAIAvailable()) {
      return new Response(JSON.stringify({ error: 'AI service not configured' }), { status: 500 })
    }

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
    const { tasks } = body

    if (!tasks || !Array.isArray(tasks)) {
      return new Response(JSON.stringify({ error: 'Tasks array is required' }), { status: 400 })
    }

    const currentDate = new Date()
    const currentDateStr = currentDate.toISOString()

    // Get next 7 days for scheduling window
    const endDate = new Date(currentDate)
    endDate.setDate(endDate.getDate() + 7)
    const endDateStr = endDate.toISOString()

    const prompt = `You are an intelligent task scheduler. Schedule the following tasks optimally within the next 7 days.

Current date/time: ${currentDateStr}
Scheduling window: ${currentDateStr} to ${endDateStr}

Tasks to schedule:
${tasks.map((t: any) => `- ID: ${t.id}, Title: ${t.title}, Priority: ${t.priority || 'medium'}, Estimated Hours: ${t.estimatedHours || 1}h`).join('\n')}

Rules:
1. High priority tasks should be scheduled earlier
2. Respect estimated hours - schedule longer tasks during contiguous time blocks
3. Assume working hours are 9 AM to 5 PM on weekdays
4. Don't schedule tasks on weekends unless absolutely necessary
5. Leave buffer time between tasks
6. Try to batch similar tasks together
7. Schedule tasks back-to-back if they are short (< 2 hours)

Return a JSON object with a "schedule" array. Each item must have:
- id: The task ID (must match input)
- startDate: When the task should start (ISO format with time)
- endDate: When the task should end (ISO format with time)
- reasoning: Brief explanation of why this time slot (optional)

Return ONLY valid JSON, no additional text.`

    const { text: responseText } = await generateText({ prompt, maxTokens: 1000 })

    // Parse the JSON response
    try {
      const parsed = JSON.parse(responseText.trim())
      const validated = scheduleSchema.parse(parsed)
      return new Response(JSON.stringify({ schedule: validated.schedule }), { status: 200 })
    } catch {
      return new Response(JSON.stringify({ schedule: [], error: 'Failed to parse AI response' }), { status: 200 })
    }
  } catch (error) {
    return handleApiError(error)
  }
}

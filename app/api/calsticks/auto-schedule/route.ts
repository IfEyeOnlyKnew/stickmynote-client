import { generateObject } from "ai"
import { z } from "zod"
import { NextResponse } from "next/server"

const scheduleSchema = z.object({
  schedule: z.array(
    z.object({
      id: z.string(),
      startDate: z.string().describe("Start date and time in ISO format"),
      endDate: z.string().describe("End date and time in ISO format"),
      reasoning: z.string().optional().describe("Why this time slot was chosen"),
    }),
  ),
})

export async function POST(req: Request) {
  try {
    const { tasks } = await req.json()

    if (!tasks || !Array.isArray(tasks)) {
      return NextResponse.json({ error: "Tasks array is required" }, { status: 400 })
    }

    const currentDate = new Date()
    const currentDateStr = currentDate.toISOString()

    // Get next 7 days for scheduling window
    const endDate = new Date(currentDate)
    endDate.setDate(endDate.getDate() + 7)
    const endDateStr = endDate.toISOString()

    const { object } = await generateObject({
      model: "openai/gpt-5",
      schema: scheduleSchema,
      prompt: `You are an intelligent task scheduler. Schedule the following tasks optimally within the next 7 days.

Current date/time: ${currentDateStr}
Scheduling window: ${currentDateStr} to ${endDateStr}

Tasks to schedule:
${tasks.map((t: any) => `- ID: ${t.id}, Title: ${t.title}, Priority: ${t.priority || "medium"}, Estimated Hours: ${t.estimatedHours || 1}h`).join("\n")}

Rules:
1. High priority tasks should be scheduled earlier
2. Respect estimated hours - schedule longer tasks during contiguous time blocks
3. Assume working hours are 9 AM to 5 PM on weekdays
4. Don't schedule tasks on weekends unless absolutely necessary
5. Leave buffer time between tasks
6. Try to batch similar tasks together
7. Schedule tasks back-to-back if they are short (< 2 hours)

For each task, provide:
- id: The task ID (must match input)
- startDate: When the task should start (ISO format with time)
- endDate: When the task should end (ISO format with time)
- reasoning: Brief explanation of why this time slot

Return the schedule optimized for productivity.`,
      maxOutputTokens: 3000,
    })

    return NextResponse.json({ schedule: object.schedule })
  } catch (error) {
    console.error("Error in auto-schedule:", error)
    return NextResponse.json({ error: "Failed to auto-schedule" }, { status: 500 })
  }
}

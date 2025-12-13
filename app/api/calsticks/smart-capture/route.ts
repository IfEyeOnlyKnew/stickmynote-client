import { generateObject } from "ai"
import { z } from "zod"
import { NextResponse } from "next/server"

const tasksSchema = z.object({
  tasks: z.array(
    z.object({
      title: z.string().describe("The task title or description"),
      description: z.string().optional().describe("Additional details about the task"),
      date: z.string().optional().describe("The due date or scheduled date in ISO format"),
      priority: z.enum(["low", "medium", "high"]).optional().describe("Task priority"),
      tags: z.array(z.string()).optional().describe("Relevant tags or categories"),
      estimatedHours: z.number().optional().describe("Estimated hours to complete"),
    }),
  ),
})

export async function POST(req: Request) {
  try {
    const { text } = await req.json()

    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "Text is required" }, { status: 400 })
    }

    const { object } = await generateObject({
      model: "openai/gpt-5",
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
      maxOutputTokens: 2000,
    })

    return NextResponse.json({ tasks: object.tasks })
  } catch (error) {
    console.error("Error in smart capture:", error)
    return NextResponse.json({ error: "Failed to parse tasks" }, { status: 500 })
  }
}

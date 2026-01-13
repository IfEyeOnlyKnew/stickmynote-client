import { generateText, isAIAvailable } from "@/lib/ai/ai-provider"
import { NextResponse } from "next/server"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

export const maxDuration = 30

export async function POST(req: Request) {
  try {
    if (!isAIAvailable()) {
      return NextResponse.json({ error: "AI service not configured" }, { status: 500 })
    }

    const authResult = await getCachedAuthUser()

    if (authResult.rateLimited) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again in a moment." },
        { status: 429, headers: { "Retry-After": "30" } },
      )
    }

    if (!authResult.user) {
      return new NextResponse("Unauthorized", { status: 401 })
    }

    const { taskContent, parentId } = await req.json()

    if (!taskContent || !parentId) {
      return new NextResponse("Task content and parent ID are required", { status: 400 })
    }

    const { text } = await generateText({
      prompt: `Break down the following task into 3-5 actionable subtasks. Return ONLY a JSON array of strings.
      
      Task: "${taskContent}"
      
      Example output: ["Draft initial outline", "Gather research materials", "Review with team"]`,
    })

    let subtasks: string[] = []
    try {
      // Clean the response to ensure it's valid JSON
      const jsonStr = text.replaceAll(/```json\n?|\n?```/g, "").trim()
      subtasks = JSON.parse(jsonStr)
    } catch (e) {
      console.error("Failed to parse AI response:", text, e)
      return new NextResponse("Failed to generate valid subtasks", { status: 500 })
    }

    return NextResponse.json({ subtasks })
  } catch (error) {
    console.error("[AI Generate Subtasks] Error:", error)
    return new NextResponse("Internal Error", { status: 500 })
  }
}

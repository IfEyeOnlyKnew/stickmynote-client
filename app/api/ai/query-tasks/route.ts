import { generateText } from "ai"
import { NextResponse } from "next/server"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

export const maxDuration = 30

export async function POST(req: Request) {
  try {
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

    const { query } = await req.json()

    if (!query) {
      return new NextResponse("Query is required", { status: 400 })
    }

    // We'll interpret the natural language query into filter criteria
    const { text } = await generateText({
      model: "xai/grok-2-1212" as any,
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
      const jsonStr = text.replaceAll(/```json\n?|\n?```/g, "").trim()
      filters = JSON.parse(jsonStr)
    } catch (e) {
      console.error("Failed to parse AI response:", text, e)
      return new NextResponse("Failed to parse query", { status: 500 })
    }

    return NextResponse.json({ filters })
  } catch (error) {
    console.error("[AI Query Tasks] Error:", error)
    return new NextResponse("Internal Error", { status: 500 })
  }
}

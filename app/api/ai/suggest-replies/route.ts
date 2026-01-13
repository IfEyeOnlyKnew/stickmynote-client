import { NextResponse } from "next/server"
import { createDatabaseClient } from "@/lib/database/database-adapter"
import { AIService } from "@/lib/ai/ai-service"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

export async function POST(request: Request) {
  try {
    await createDatabaseClient()
    const authResult = await getCachedAuthUser()

    if (authResult.rateLimited) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again in a moment." },
        { status: 429, headers: { "Retry-After": "30" } },
      )
    }

    if (!authResult.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { content, topic } = await request.json()

    if (!content) {
      return NextResponse.json({ error: "Content is required" }, { status: 400 })
    }

    // Generate reply suggestions using AI
    const suggestions = await AIService.suggestReplies(content, topic)

    return NextResponse.json({ suggestions })
  } catch (error) {
    console.error("[suggest-replies] Error:", error)
    return NextResponse.json({ error: "Failed to suggest replies" }, { status: 500 })
  }
}

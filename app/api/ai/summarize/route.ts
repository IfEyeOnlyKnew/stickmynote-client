import { NextResponse } from "next/server"
import { createDatabaseClient } from "@/lib/database/database-adapter"
import { GrokService } from "@/lib/ai/grok-service"
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

    const { content, maxLength } = await request.json()

    if (!content) {
      return NextResponse.json({ error: "Content is required" }, { status: 400 })
    }

    // Generate summary using Grok
    const summary = await GrokService.summarizeContent(content, maxLength)

    return NextResponse.json({ summary })
  } catch (error) {
    console.error("[summarize] Error:", error)
    return NextResponse.json({ error: "Failed to summarize content" }, { status: 500 })
  }
}

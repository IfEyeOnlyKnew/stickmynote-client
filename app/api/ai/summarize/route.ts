import { NextResponse } from "next/server"
import { createDatabaseClient } from "@/lib/database/database-adapter"
import { summarizeContent, isAIAvailable, getProviderDisplayName, checkOllamaHealth } from "@/lib/ai/ai-provider"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

export const maxDuration = 60 // Allow up to 60 seconds for AI processing

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

    // Check if AI is available
    if (!isAIAvailable()) {
      return NextResponse.json(
        { error: "AI service not configured. Please set OLLAMA_MODEL or other AI provider credentials." },
        { status: 503 }
      )
    }

    // Check Ollama health if using Ollama
    const ollamaHealth = await checkOllamaHealth()
    if (!ollamaHealth.available && process.env.AI_PROVIDER === "ollama") {
      return NextResponse.json(
        { error: `Ollama server not available: ${ollamaHealth.error}` },
        { status: 503 }
      )
    }

    const { content, maxLength } = await request.json()

    if (!content) {
      return NextResponse.json({ error: "Content is required" }, { status: 400 })
    }

    // Generate summary using configured AI provider (Ollama, Azure, etc.)
    const summary = await summarizeContent(content, maxLength)
    const provider = getProviderDisplayName()

    return NextResponse.json({ summary, provider })
  } catch (error) {
    console.error("[summarize] Error:", error)
    const errorMessage = error instanceof Error ? error.message : "Failed to summarize content"
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

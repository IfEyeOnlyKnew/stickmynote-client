import { createDatabaseClient } from "@/lib/database/database-adapter"
import { NextResponse } from "next/server"
import { AIService } from "@/lib/ai/ai-service"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"
import { isAIAvailable, checkOllamaHealth, getProviderDisplayName } from "@/lib/ai/ai-provider"

export const maxDuration = 60 // Increase timeout for AI processing

export async function POST(req: Request, { params }: { params: Promise<{ stickId: string }> }) {
  try {
    const { stickId } = await params
    const db = await createDatabaseClient()

    const { user, error: authError, rateLimited } = await getCachedAuthUser()

    if (rateLimited) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 })
    }

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if AI is available before proceeding
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
        { error: `Ollama server not available: ${ollamaHealth.error}. Make sure Ollama is running at ${process.env.OLLAMA_BASE_URL || 'http://localhost:11434'}` },
        { status: 503 }
      )
    }

    const orgContext = await getOrgContext()
    if (!orgContext) {
      return NextResponse.json({ error: "No organization context" }, { status: 403 })
    }

    const { data: stick, error: stickError } = await db
      .from("social_sticks")
      .select("*")
      .eq("id", stickId)
      .eq("org_id", orgContext.orgId)
      .maybeSingle()

    if (stickError || !stick) {
      return NextResponse.json({ error: "Stick not found" }, { status: 404 })
    }

    // Fetch replies
    const { data: replies } = await db
      .from("social_stick_replies")
      .select("*")
      .eq("social_stick_id", stickId)
      .order("created_at", { ascending: true })

    // Fetch user data for replies
    const userIds = [...new Set((replies || []).map((r: any) => r.user_id).filter(Boolean))]
    let userMap: Record<string, { full_name?: string; email?: string }> = {}
    if (userIds.length > 0) {
      const { data: users } = await db
        .from("users")
        .select("id, full_name, email")
        .in("id", userIds)

      if (users) {
        userMap = Object.fromEntries(users.map((u: any) => [u.id, { full_name: u.full_name, email: u.email }]))
      }
    }

    const formattedReplies =
      replies?.map((r: any) => {
        const userData = userMap[r.user_id]
        return {
          content: r.content,
          author: userData?.full_name || userData?.email || "Unknown",
          created_at: r.created_at,
        }
      }) || []

    console.log(`[Summarize Stick] Generating summary for stick ${stickId} with ${formattedReplies.length} replies using ${getProviderDisplayName()}`)

    // Generate AI summary using configured provider (Ollama, Azure, etc.)
    const summary = await AIService.generateLiveSummary({
      topic: stick.topic || "Untitled",
      content: stick.content,
      replies: formattedReplies,
    })

    // Extract action items
    const actionItems = await AIService.extractActionItems({
      topic: stick.topic || "Untitled",
      content: stick.content,
      replies: formattedReplies,
    })

    // Generate suggested questions
    const suggestedQuestions = await AIService.generateNextQuestions({
      topic: stick.topic || "Untitled",
      content: stick.content,
      summary,
      sentiment: stick.ai_sentiment || undefined,
    })

    // Update stick with AI data
    const { error: updateError } = await db
      .from("social_sticks")
      .update({
        live_summary: summary,
        action_items: actionItems,
        suggested_questions: suggestedQuestions,
        last_summarized_at: new Date().toISOString(),
        summary_reply_count: replies?.length || 0,
      })
      .eq("id", stickId)

    if (updateError) {
      console.error("Error updating stick with AI data:", updateError)
      return NextResponse.json({ error: "Error saving summary to database" }, { status: 500 })
    }

    console.log(`[Summarize Stick] Successfully generated summary for stick ${stickId}`)

    return NextResponse.json({
      summary,
      actionItems,
      suggestedQuestions,
      replyCount: replies?.length || 0,
      provider: getProviderDisplayName(),
    })
  } catch (error) {
    console.error("[Summarize Stick] Error:", error)
    const errorMessage = error instanceof Error ? error.message : "Internal Error"
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

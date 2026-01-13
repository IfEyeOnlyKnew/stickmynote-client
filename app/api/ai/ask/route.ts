import { NextResponse } from "next/server"
import { createDatabaseClient } from "@/lib/database/database-adapter"
import { generateText, isAIAvailable } from "@/lib/ai/ai-provider"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    if (!isAIAvailable()) {
      return NextResponse.json({ error: "AI service not configured" }, { status: 500 })
    }

    const db = await createDatabaseClient()
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

    const user = authResult.user

    const { stickId, stickType, question } = await request.json()

    if (!stickId || !stickType || !question) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    if (question.length > 200) {
      return NextResponse.json({ error: "Question exceeds 200 characters" }, { status: 400 })
    }

    // Get user's organization
    const { data: member } = await db
      .from("organization_members")
      .select("org_id")
      .eq("user_id", user.id)
      .maybeSingle()

    const orgId = member?.org_id

    // Check remaining sessions
    let maxSessions = 2
    if (orgId) {
      const { data: org } = await db
        .from("organizations")
        .select("ai_sessions_per_day")
        .eq("id", orgId)
        .maybeSingle()

      if (org?.ai_sessions_per_day) {
        maxSessions = org.ai_sessions_per_day
      }
    }

    const today = new Date().toISOString().split("T")[0]

    let sessionCount = 0
    try {
      const { data: sessions } = await db
        .from("ai_answer_sessions")
        .select("id")
        .eq("user_id", user.id)
        .eq("session_date", today)

      sessionCount = sessions?.length || 0
    } catch {
      // Table might not exist yet, continue without limit
      console.log("ai_answer_sessions table not available, skipping limit check")
    }

    if (sessionCount >= maxSessions) {
      return NextResponse.json({ error: "Daily AI session limit reached. Try again tomorrow." }, { status: 429 })
    }

    // Generate answer using unified AI provider
    const prompt = `You are a helpful assistant. Please provide a clear, concise, and informative answer to the following question:

Question: ${question}

Provide a helpful answer. If you need more context to answer properly, explain what additional information would be helpful.`

    const { text: answer } = await generateText({
      prompt,
      maxTokens: 500,
    })

    // Log the session (ignore errors if table doesn't exist)
    try {
      await db.from("ai_answer_sessions").insert({
        user_id: user.id,
        org_id: orgId,
        stick_id: stickId,
        stick_type: stickType,
        question,
        answer,
        session_date: today,
      })
    } catch {
      // Table might not exist yet
      console.log("Could not log AI session, table may not exist")
    }

    return NextResponse.json({ answer })
  } catch (error) {
    console.error("Error in AI ask:", error)
    const errorMessage = error instanceof Error ? error.message : "Failed to generate answer"
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

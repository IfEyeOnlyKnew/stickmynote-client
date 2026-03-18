import { createDatabaseClient, createServiceDatabaseClient } from "@/lib/database/database-adapter"
import { NextResponse } from "next/server"
import { AIService } from "@/lib/ai/ai-service"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

export const maxDuration = 30

export async function POST(req: Request, { params }: { params: Promise<{ padId: string }> }) {
  try {
    const { padId } = await params
    const { question } = await req.json()

    if (!question || typeof question !== "string") {
      return new NextResponse("Question is required", { status: 400 })
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
      return new NextResponse("Unauthorized", { status: 401 })
    }
    const user = authResult.user

    const orgContext = await getOrgContext()
    if (!orgContext) {
      return new NextResponse("No organization context", { status: 403 })
    }

    // Fetch all sticks in the pad
    console.log(`[Ask Pad] Fetching sticks for pad ${padId}, org ${orgContext.orgId}`)
    const { data: sticks, error: sticksError } = await db
      .from("social_sticks")
      .select("id, topic, content, ai_live_summary")
      .eq("social_pad_id", padId)
      .eq("org_id", orgContext.orgId)
      .order("created_at", { ascending: false })
      .limit(20)

    if (sticksError) {
      console.error("[Ask Pad] Error fetching sticks:", JSON.stringify(sticksError))
      return NextResponse.json({ error: "Error fetching sticks", details: sticksError.message }, { status: 500 })
    }

    if (!sticks || sticks.length === 0) {
      return NextResponse.json({
        answer: "There are no sticks in this pad yet to answer questions about.",
        citations: [],
      })
    }

    // Fetch replies for each stick
    const stickIds = sticks.map((s) => s.id)
    const { data: allReplies, error: repliesError } = await db
      .from("social_stick_replies")
      .select("id, social_stick_id, content, category, calstick_id, user_id")
      .in("social_stick_id", stickIds)
      .eq("org_id", orgContext.orgId)
      .order("created_at", { ascending: true })
      .limit(100)

    if (repliesError) {
      console.error("[Ask Pad] Error fetching replies:", JSON.stringify(repliesError))
      // Continue without replies rather than failing
    }

    // Fetch user names for reply authors
    const userIds = allReplies?.length
      ? [...new Set(allReplies.map((r: any) => r.user_id))] as string[]
      : []
    const serviceDb = await createServiceDatabaseClient()
    const { data: users } = userIds.length > 0
      ? await serviceDb.from("users").select("id, full_name").in("id", userIds)
      : { data: [] }
    const userMap = new Map((users || []).map((u: any) => [u.id, u.full_name || "Unknown"]))

    // Fetch CalStick details for replies that have calstick_id
    const calstickIds = (allReplies || [])
      .filter((r: any) => r.calstick_id)
      .map((r: any) => r.calstick_id)

    let calstickMap: Record<string, { status?: string; completed?: boolean }> = {}
    if (calstickIds.length > 0) {
      const { data: calsticks } = await db
        .from("calsticks")
        .select("id, status, completed")
        .in("id", calstickIds)

      if (calsticks) {
        calstickMap = Object.fromEntries(
          calsticks.map((c: any) => [c.id, { status: c.status, completed: c.completed }])
        )
      }
    }

    // Group replies by stick
    const repliesByStick = (allReplies || []).reduce(
      (acc: any, reply: any) => {
        if (!acc[reply.social_stick_id]) {
          acc[reply.social_stick_id] = []
        }
        acc[reply.social_stick_id].push(reply)
        return acc
      },
      {} as Record<string, any[]>
    )

    // Use AI to answer the question
    console.log(`[Ask Pad] Processing question for pad ${padId} with ${sticks.length} sticks and ${allReplies?.length || 0} replies`)

    // Debug: Log the actual context being sent to AI
    const debugContext = sticks.map((s: any) => ({
      topic: s.topic,
      replyCount: (repliesByStick[s.id] || []).length,
      replies: (repliesByStick[s.id] || []).map((r: any) => ({
        content: r.content?.substring(0, 50),
        is_calstick: !!r.calstick_id,
        calstick_status: r.calstick_id ? calstickMap[r.calstick_id]?.status : null,
        calstick_completed: r.calstick_id ? calstickMap[r.calstick_id]?.completed : null,
        user_name: userMap.get(r.user_id),
      })),
    }))
    console.log(`[Ask Pad] Context being sent to AI:`, JSON.stringify(debugContext, null, 2))
    const result = await AIService.answerPadQuestion({
      question,
      sticks: sticks.map((s: any) => ({
        topic: s.topic || "Untitled",
        content: s.content,
        summary: s.ai_live_summary || undefined,
        replies: (repliesByStick[s.id] || []).map((r: any) => ({
          content: r.content,
          category: r.category || undefined,
          is_calstick: !!r.calstick_id,
          calstick_status: r.calstick_id ? calstickMap[r.calstick_id]?.status : undefined,
          calstick_completed: r.calstick_id ? calstickMap[r.calstick_id]?.completed : undefined,
          user_name: userMap.get(r.user_id) || "Unknown",
        })),
      })),
    })
    console.log(`[Ask Pad] AI response received: answer="${result.answer?.substring(0, 100)}...", citations=${result.citations?.length}`)

    const { data: qaRecord, error: qaError } = await db
      .from("social_qa_history")
      .insert({
        social_pad_id: padId,
        org_id: orgContext.orgId,
        question,
        answer: result.answer,
        citations: result.citations,
        asked_by: user.id,
      })
      .select("id")
      .single()

    if (qaError) {
      console.error("Error saving Q&A history:", qaError)
      // Don't fail the request, just log the error
    }

    return NextResponse.json({
      answer: result.answer,
      citations: result.citations,
      sticksSearched: sticks.length,
      qa_id: qaRecord?.id || null,
    })
  } catch (error) {
    console.error("[Ask Pad] Error:", error)
    return new NextResponse("Internal Error", { status: 500 })
  }
}

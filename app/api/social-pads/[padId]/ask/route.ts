import { createDatabaseClient } from "@/lib/database/database-adapter"
import { NextResponse } from "next/server"
import { GrokService } from "@/lib/ai/grok-service"
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
    const { data: sticks, error: sticksError } = await db
      .from("social_sticks")
      .select(
        `
        id,
        topic,
        content,
        live_summary,
        reply_count
      `,
      )
      .eq("social_pad_id", padId)
      .eq("org_id", orgContext.orgId)
      .order("created_at", { ascending: false })
      .limit(20)

    if (sticksError) {
      console.error("Error fetching sticks:", sticksError)
      return new NextResponse("Error fetching sticks", { status: 500 })
    }

    if (!sticks || sticks.length === 0) {
      return NextResponse.json({
        answer: "There are no sticks in this pad yet to answer questions about.",
        citations: [],
      })
    }

    // Use AI to answer the question
    const result = await GrokService.answerPadQuestion({
      question,
      sticks: sticks.map((s) => ({
        topic: s.topic || "Untitled",
        content: s.content,
        summary: s.live_summary || undefined,
        replies_count: s.reply_count || 0,
      })),
    })

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

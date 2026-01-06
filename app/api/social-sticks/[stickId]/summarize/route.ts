import { createDatabaseClient } from "@/lib/database/database-adapter"
import { NextResponse } from "next/server"
import { GrokService } from "@/lib/ai/grok-service"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

export const maxDuration = 30

export async function POST(req: Request, { params }: { params: Promise<{ stickId: string }> }) {
  try {
    const { stickId } = await params
    const db = await createDatabaseClient()

    const { user, error: authError, rateLimited } = await getCachedAuthUser()

    if (rateLimited) {
      return new NextResponse("Too many requests", { status: 429 })
    }

    if (authError || !user) {
      return new NextResponse("Unauthorized", { status: 401 })
    }

    const orgContext = await getOrgContext()
    if (!orgContext) {
      return new NextResponse("No organization context", { status: 403 })
    }

    const { data: stick, error: stickError } = await db
      .from("social_sticks")
      .select("*")
      .eq("id", stickId)
      .eq("org_id", orgContext.orgId)
      .maybeSingle()

    if (stickError || !stick) {
      return new NextResponse("Stick not found", { status: 404 })
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

    // Generate AI summary
    const summary = await GrokService.generateLiveSummary({
      topic: stick.topic || "Untitled",
      content: stick.content,
      replies: formattedReplies,
    })

    // Extract action items
    const actionItems = await GrokService.extractActionItems({
      topic: stick.topic || "Untitled",
      content: stick.content,
      replies: formattedReplies,
    })

    // Generate suggested questions
    const suggestedQuestions = await GrokService.generateNextQuestions({
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
      return new NextResponse("Error updating stick", { status: 500 })
    }

    return NextResponse.json({
      summary,
      actionItems,
      suggestedQuestions,
      replyCount: replies?.length || 0,
    })
  } catch (error) {
    console.error("[Summarize Stick] Error:", error)
    return new NextResponse("Internal Error", { status: 500 })
  }
}

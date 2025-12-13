import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    const authResult = await getCachedAuthUser(supabase)
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

    const { stickId, stickType, question, answer } = await request.json()

    if (!stickId || !stickType || !question || !answer) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Find the most recent session for this stick and user
    const { data: session } = await supabase
      .from("ai_answer_sessions")
      .select("id")
      .eq("user_id", user.id)
      .eq("stick_id", stickId)
      .eq("question", question)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }

    // Update session to mark as kept
    await supabase.from("ai_answer_sessions").update({ was_kept: true }).eq("id", session.id)

    // Create the attachment
    const { error: attachmentError } = await supabase.from("ai_answer_attachments").insert({
      session_id: session.id,
      stick_id: stickId,
      stick_type: stickType,
      question,
      answer,
      created_by: user.id,
    })

    if (attachmentError) {
      console.error("Error creating attachment:", attachmentError)
      return NextResponse.json({ error: "Failed to save attachment" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error keeping answer:", error)
    return NextResponse.json({ error: "Failed to keep answer" }, { status: 500 })
  }
}

import { NextResponse } from "next/server"
import { createDatabaseClient, createServiceDatabaseClient } from "@/lib/database/database-adapter"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

export const dynamic = "force-dynamic"

interface AIAnswer {
  question: string
  answer: string
  created_at: string
}

export async function POST(request: Request) {
  try {
    const db = await createDatabaseClient()
    const serviceDb = await createServiceDatabaseClient()

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

    const { stickId, stickType, question, answer } = await request.json()

    if (!stickId || !stickType || !question || !answer) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Get the note owner's user_id - answers should be saved to the owner's tabs
    const { data: note, error: noteError } = await serviceDb
      .from("personal_sticks")
      .select("user_id")
      .eq("id", stickId)
      .single()

    if (noteError || !note) {
      console.error("Error fetching note:", noteError)
      return NextResponse.json({ error: "Note not found" }, { status: 404 })
    }

    const noteOwnerId = note.user_id

    // Save the Q&A to the Details tab
    const aiAnswer: AIAnswer = {
      question,
      answer,
      created_at: new Date().toISOString(),
    }

    // Check if details tab exists for the note owner
    const { data: existingTab } = await serviceDb
      .from("personal_sticks_tabs")
      .select("id, tab_data")
      .eq("personal_stick_id", stickId)
      .eq("user_id", noteOwnerId)
      .eq("tab_type", "details")
      .maybeSingle()

    if (existingTab) {
      // Update existing tab - add to ai_answers array
      let currentData: { ai_answers?: AIAnswer[]; [key: string]: any } = {}
      try {
        if (typeof existingTab.tab_data === "string") {
          currentData = JSON.parse(existingTab.tab_data)
        } else if (existingTab.tab_data && typeof existingTab.tab_data === "object") {
          currentData = existingTab.tab_data
        }
      } catch {
        currentData = {}
      }

      const updatedAnswers = [...(currentData.ai_answers || []), aiAnswer]
      const newTabData = { ...currentData, ai_answers: updatedAnswers }

      const { error: updateError } = await serviceDb
        .from("personal_sticks_tabs")
        .update({
          tab_data: newTabData,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingTab.id)

      if (updateError) {
        console.error("Error updating tab:", updateError)
        return NextResponse.json({ error: "Failed to save answer" }, { status: 500 })
      }
    } else {
      // Create new details tab for the note owner
      const { error: insertError } = await serviceDb.from("personal_sticks_tabs").insert({
        personal_stick_id: stickId,
        user_id: noteOwnerId,
        tab_type: "details",
        tab_name: "Details",
        tab_content: "Note details and AI answers",
        tab_data: { ai_answers: [aiAnswer] },
        tab_order: 3,
      })

      if (insertError) {
        console.error("Error inserting tab:", insertError)
        return NextResponse.json({ error: "Failed to save answer" }, { status: 500 })
      }
    }

    // Also log to ai_answer_sessions if table exists (for analytics)
    try {
      const { data: session } = await db
        .from("ai_answer_sessions")
        .select("id")
        .eq("user_id", user.id)
        .eq("stick_id", stickId)
        .eq("question", question)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()

      if (session) {
        await db.from("ai_answer_sessions").update({ was_kept: true }).eq("id", session.id)
      }
    } catch {
      // Table might not exist, continue without error
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error keeping answer:", error)
    return NextResponse.json({ error: "Failed to keep answer" }, { status: 500 })
  }
}

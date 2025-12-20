import { NextRequest, NextResponse } from "next/server"
import { createServiceDatabaseClient } from "@/lib/database/service-client"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

// GET - Get all replies for a team note
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ noteId: string }> }
) {
  try {
    const authResult = await getCachedAuthUser()
    if (!authResult?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { noteId } = await params
    const db = await createServiceDatabaseClient()

    // Fetch replies with user info
    const { data: replies, error } = await db
      .from("team_note_replies")
      .select(`
        *,
        user:users(username, email)
      `)
      .eq("team_note_id", noteId)
      .order("created_at", { ascending: true })

    if (error) {
      console.error("Error fetching replies:", error)
      return NextResponse.json({ error: "Failed to fetch replies" }, { status: 500 })
    }

    return NextResponse.json(replies || [])
  } catch (error) {
    console.error("Error in team note replies API:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST - Create a new reply
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ noteId: string }> }
) {
  try {
    const authResult = await getCachedAuthUser()
    if (!authResult?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const user = authResult.user
    const { noteId } = await params
    const body = await request.json()
    const { content, color = "#f3f4f6" } = body

    if (!content?.trim()) {
      return NextResponse.json({ error: "Content is required" }, { status: 400 })
    }

    const db = await createServiceDatabaseClient()

    // Create the reply
    const { data: reply, error } = await db
      .from("team_note_replies")
      .insert({
        team_note_id: noteId,
        content: content.trim(),
        user_id: user.id,
        color,
      })
      .select(`
        *,
        user:users(username, email)
      `)
      .single()

    if (error) {
      console.error("Error creating reply:", error)
      return NextResponse.json({ error: "Failed to create reply" }, { status: 500 })
    }

    return NextResponse.json(reply)
  } catch (error) {
    console.error("Error in team note replies API:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

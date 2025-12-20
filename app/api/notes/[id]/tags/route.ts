"use server"

import { NextRequest, NextResponse } from "next/server"
import { createServiceDatabaseClient } from "@/lib/database/service-client"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

// GET - Get a note and its tags
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await getCachedAuthUser()
    if (!authResult?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const user = authResult.user
    const { id: noteId } = await params
    const db = await createServiceDatabaseClient()

    // Get the note
    const { data: noteData, error: noteError } = await db
      .from("notes")
      .select("*")
      .eq("id", noteId)
      .eq("user_id", user.id)
      .maybeSingle()

    if (noteError) {
      console.error("Error fetching note:", noteError)
      return NextResponse.json({ error: "Failed to fetch note" }, { status: 500 })
    }

    if (!noteData) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 })
    }

    // Get the tags
    const { data: tagsData, error: tagsError } = await db
      .from("tags")
      .select("*")
      .eq("note_id", noteId)
      .eq("user_id", user.id)
      .order("tag_order", { ascending: true })

    if (tagsError) {
      console.error("Error fetching tags:", tagsError)
    }

    return NextResponse.json({
      note: noteData,
      tags: tagsData || [],
    })
  } catch (error) {
    console.error("Error in tags API:", error)
    return NextResponse.json({ error: "Failed to fetch note and tags" }, { status: 500 })
  }
}

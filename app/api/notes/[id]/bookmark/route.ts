import { type NextRequest, NextResponse } from "next/server"
import { createDatabaseClient } from "@/lib/database/database-adapter"
import { requireAuthAndOrg } from "@/lib/api/route-helpers"

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const db = await createDatabaseClient()

    const auth = await requireAuthAndOrg()
    if ("response" in auth) return auth.response
    const { user, orgContext } = auth

    const noteId = id
    const orgId = orgContext.orgId

    const { data: note, error: noteError } = await db
      .from("personal_sticks")
      .select("id")
      .eq("id", noteId)
      .eq("org_id", orgId)
      .maybeSingle()

    if (noteError || !note) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 })
    }

    const { data: existingBookmark } = await db
      .from("personal_sticks_reactions")
      .select("id")
      .eq("personal_stick_id", noteId)
      .eq("user_id", user.id)
      .eq("reaction_type", "bookmark")
      .maybeSingle()

    if (existingBookmark) {
      // Remove bookmark
      const { error } = await db.from("personal_sticks_reactions").delete().eq("id", existingBookmark.id)

      if (error) {
        console.error("Error removing bookmark:", error)
        return NextResponse.json({ error: "Failed to remove bookmark" }, { status: 500 })
      }

      return NextResponse.json({ success: true, bookmarked: false })
    } else {
      const { error } = await db.from("personal_sticks_reactions").insert({
        personal_stick_id: noteId,
        user_id: user.id,
        reaction_type: "bookmark",
      })

      if (error) {
        console.error("Error adding bookmark:", error)
        return NextResponse.json({ error: "Failed to add bookmark" }, { status: 500 })
      }

      return NextResponse.json({ success: true, bookmarked: true })
    }
  } catch (error) {
    console.error("Error in bookmark API:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const db = await createDatabaseClient()
    const noteId = id

    const auth = await requireAuthAndOrg()
    if ("response" in auth) return NextResponse.json({ isBookmarked: false })
    const { user } = auth

    const { data: bookmark } = await db
      .from("personal_sticks_reactions")
      .select("id")
      .eq("personal_stick_id", noteId)
      .eq("user_id", user.id)
      .eq("reaction_type", "bookmark")
      .maybeSingle()

    return NextResponse.json({ isBookmarked: !!bookmark })
  } catch (error) {
    console.error("Error checking bookmark status:", error)
    return NextResponse.json({ isBookmarked: false })
  }
}

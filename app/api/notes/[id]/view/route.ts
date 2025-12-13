import type { NextRequest } from "next/server"

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  // Only "note_created", "note_updated", "reply_added" are allowed
  // To re-enable, add "view" to the personal_sticks_activities_activity_type_check constraint
  return new Response(JSON.stringify({ success: true, message: "View tracking disabled" }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  })

  /*
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const noteId = params.id

    // Track view in personal_sticks_activities table
    const { error } = await supabase.from("personal_sticks_activities").insert({
      note_id: noteId,
      user_id: user.id,
      activity_type: "view",
      metadata: {
        viewed_at: new Date().toISOString(),
      },
    })

    if (error) {
      console.error("Error tracking view:", error)
      return NextResponse.json({ error: "Failed to track view" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error in view tracking:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
  */
}

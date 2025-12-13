import { createSupabaseServer, getSupabaseServiceClient } from "@/lib/supabase-server"
import { NextResponse, type NextRequest } from "next/server"
import { validateCSRFMiddleware } from "@/lib/csrf"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

export async function DELETE(request: NextRequest) {
  try {
    const isCSRFValid = await validateCSRFMiddleware(request)
    if (!isCSRFValid) {
      return NextResponse.json({ error: "Invalid or missing CSRF token" }, { status: 403 })
    }

    const supabase = await createSupabaseServer()

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

    const userId = authResult.user.id

    // Delete user data in the correct order (respecting foreign key constraints)

    // 1. Delete tags first (if they reference notes)
    const { error: tagsError } = await supabase.from("tags").delete().eq("user_id", userId)

    // 2. Delete replies (if they reference notes)
    const { error: repliesError } = await supabase.from("replies").delete().eq("user_id", userId)

    // 3. Delete note tabs (if they reference notes)
    const { error: noteTabsError } = await supabase.from("note_tabs").delete().eq("user_id", userId)

    // 4. Delete notes
    const { error: notesError } = await supabase.from("notes").delete().eq("user_id", userId)

    // 5. Delete user profile
    const { error: userProfileError } = await supabase.from("users").delete().eq("id", userId)

    // 6. Delete from auth.users table using admin client
    const adminSupabase = await getSupabaseServiceClient()
    const { error: authDeleteError } = await adminSupabase.auth.admin.deleteUser(userId)
    if (authDeleteError) {
      return NextResponse.json({ error: "Failed to delete authentication record" }, { status: 500 })
    }

    // 7. Sign out the user (this will happen automatically after auth deletion)
    await supabase.auth.signOut()

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to delete account",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

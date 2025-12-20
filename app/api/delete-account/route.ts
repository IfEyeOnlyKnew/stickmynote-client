import { createDatabaseClient } from "@/lib/database/database-adapter"
import { NextResponse, type NextRequest } from "next/server"
import { validateCSRFMiddleware } from "@/lib/csrf"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"
import { clearSession } from "@/lib/auth/local-auth"

export async function DELETE(request: NextRequest) {
  try {
    const isCSRFValid = await validateCSRFMiddleware(request)
    if (!isCSRFValid) {
      return NextResponse.json({ error: "Invalid or missing CSRF token" }, { status: 403 })
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
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = authResult.user.id

    // Delete user data in the correct order (respecting foreign key constraints)

    // 1. Delete tags first (if they reference notes)
    await db.from("tags").delete().eq("user_id", userId)

    // 2. Delete replies (if they reference notes)
    await db.from("replies").delete().eq("user_id", userId)

    // 3. Delete note tabs (if they reference notes)
    await db.from("note_tabs").delete().eq("user_id", userId)

    // 4. Delete notes
    await db.from("notes").delete().eq("user_id", userId)

    // 5. Delete user profile - For local auth, this also deletes the auth record
    const { error: userProfileError } = await db.from("users").delete().eq("id", userId)
    if (userProfileError) {
      return NextResponse.json({ error: "Failed to delete user account" }, { status: 500 })
    }

    // 6. Clear the session
    await clearSession()

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

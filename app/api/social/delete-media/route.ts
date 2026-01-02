import { type NextRequest, NextResponse } from "next/server"
import { createDatabaseClient } from "@/lib/database/database-adapter"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"
import { del } from "@/lib/storage/local-storage"

export async function DELETE(request: NextRequest) {

  try {
    await createDatabaseClient()

    const { user, error: authError, rateLimited } = await getCachedAuthUser()

    if (rateLimited) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 })
    }

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { url } = await request.json()

    if (!url) {
      return NextResponse.json({ error: "No URL provided" }, { status: 400 })
    }

    // Verify user owns this file by checking if their user ID is in the path
    if (!url.includes(`social-media/${user.id}/`)) {
      return NextResponse.json({ error: "Unauthorized to delete this file" }, { status: 403 })
    }

    // Delete from local storage
    await del(url)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("[v0] Media deletion error:", error)
    return NextResponse.json(
      {
        error: "Delete failed: " + (error.message || "Unknown error"),
      },
      { status: 500 },
    )
  }
}

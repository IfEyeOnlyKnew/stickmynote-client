import { createDatabaseClient } from "@/lib/database/database-adapter"
import { NextResponse } from "next/server"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

// DELETE /api/saved-searches/[id] - Delete saved search
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
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
    const user = authResult.user

    const { id } = params

    const { error } = await db.from("saved_searches").delete().eq("id", id).eq("user_id", user.id)

    if (error) {
      console.error("[v0] Error deleting saved search:", error)
      return NextResponse.json({ error: "Failed to delete saved search" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Error in saved search DELETE:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

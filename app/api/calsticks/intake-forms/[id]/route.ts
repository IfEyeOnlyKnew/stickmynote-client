import { type NextRequest, NextResponse } from "next/server"
import { createDatabaseClient } from "@/lib/database/database-adapter"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const db = await createDatabaseClient()
    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) {
      return NextResponse.json({ error: "Rate limited" }, { status: 429, headers: { "Retry-After": "30" } })
    }
    if (!authResult.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { error } = await db
      .from("intake_forms")
      .delete()
      .eq("id", id)
      .eq("owner_id", authResult.userId)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[intake-forms DELETE] Error:", error)
    return NextResponse.json({ error: "Failed to delete form" }, { status: 500 })
  }
}

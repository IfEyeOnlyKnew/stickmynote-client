import { NextResponse } from "next/server"
import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from "@/lib/auth/cached-auth"
import { db } from "@/lib/database/pg-client"

// PATCH /api/notifications/[id] - Mark a notification as read/unread
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const authResult = await getCachedAuthUser()

    if (authResult.rateLimited) {
      return createRateLimitResponse()
    }
    if (!authResult.user) {
      return createUnauthorizedResponse()
    }

    const body = await request.json()
    const { read } = body

    if (typeof read !== "boolean") {
      return NextResponse.json({ error: "Invalid read status" }, { status: 400 })
    }

    const result = await db.query(
      `UPDATE notifications
          SET is_read = $1,
              read_at = CASE WHEN $1 = true THEN NOW() ELSE NULL END,
              updated_at = NOW()
        WHERE id = $2 AND user_id = $3
        RETURNING id, is_read AS read`,
      [read, id, authResult.user.id],
    )

    if (result.rowCount === 0) {
      return NextResponse.json({ error: "Notification not found" }, { status: 404 })
    }

    return NextResponse.json({ notification: result.rows[0] })
  } catch (error) {
    console.error("Error in notification PATCH:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE /api/notifications/[id] - Delete a notification
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const authResult = await getCachedAuthUser()

    if (authResult.rateLimited) {
      return createRateLimitResponse()
    }
    if (!authResult.user) {
      return createUnauthorizedResponse()
    }

    const result = await db.query(
      `DELETE FROM notifications WHERE id = $1 AND user_id = $2`,
      [id, authResult.user.id],
    )

    if (result.rowCount === 0) {
      return NextResponse.json({ error: "Notification not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error in notification DELETE:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

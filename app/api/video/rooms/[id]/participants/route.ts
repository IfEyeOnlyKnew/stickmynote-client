import { type NextRequest, NextResponse } from "next/server"
import { createDatabaseClient } from "@/lib/database/database-adapter"
import { db } from "@/lib/database/pg-client"

export const dynamic = "force-dynamic"

const VALID_STATUSES = new Set(["invited", "joined", "declined", "left"])

// PATCH /api/video/rooms/:id/participants — invitee updates their own status
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: roomId } = await params
    const dbClient = await createDatabaseClient()
    const {
      data: { user },
    } = await dbClient.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const status = typeof body?.status === "string" ? body.status : ""
    if (!VALID_STATUSES.has(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 })
    }

    const result = await db.query(
      `UPDATE video_room_participants
          SET status = $1, updated_at = NOW()
        WHERE room_id = $2 AND user_id = $3
        RETURNING id, status`,
      [status, roomId, user.id],
    )

    if (result.rowCount === 0) {
      return NextResponse.json({ error: "Not invited to this room" }, { status: 404 })
    }

    return NextResponse.json({ ok: true, status })
  } catch (error) {
    console.error("[video participants] PATCH error:", error)
    return NextResponse.json({ error: "Failed to update status" }, { status: 500 })
  }
}

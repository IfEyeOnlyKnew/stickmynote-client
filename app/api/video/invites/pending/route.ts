import { NextResponse } from "next/server"
import { createDatabaseClient } from "@/lib/database/database-adapter"
import { db } from "@/lib/database/pg-client"

export const dynamic = "force-dynamic"

// GET /api/video/invites/pending — list pending video invites for the current user
export async function GET() {
  try {
    const dbClient = await createDatabaseClient()
    const {
      data: { user },
    } = await dbClient.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const result = await db.query<{
      room_id: string
      room_name: string
      room_url: string
      invited_at: string
      invited_by_name: string | null
    }>(
      `SELECT vr.id AS room_id,
              vr.name AS room_name,
              vr.room_url,
              vrp.created_at AS invited_at,
              COALESCE(inviter.full_name, inviter.username, inviter.email) AS invited_by_name
         FROM video_room_participants vrp
         JOIN video_rooms vr ON vr.id = vrp.room_id
         LEFT JOIN users inviter ON inviter.id = vrp.invited_by
        WHERE vrp.user_id = $1
          AND vrp.status = 'invited'
        ORDER BY vrp.created_at DESC`,
      [user.id],
    )

    return NextResponse.json({
      count: result.rows.length,
      invites: result.rows,
    })
  } catch (error) {
    console.error("[video invites] pending error:", error)
    return NextResponse.json({ error: "Failed to fetch invites" }, { status: 500 })
  }
}

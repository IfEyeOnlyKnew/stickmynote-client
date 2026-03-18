import { db } from "@/lib/database/pg-client"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"
import { type NextRequest, NextResponse } from "next/server"

// GET /api/sticks/[id]/map - Get all connected component counts for a stick
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: stickId } = await params

    const { user, error: authError, rateLimited } = await getCachedAuthUser()

    if (rateLimited) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 })
    }

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Run all count queries in parallel
    const [calsticks, replies, notedPages, chats, videoRooms, tabs] = await Promise.all([
      // CalSticks count
      db.query(
        `SELECT
          COUNT(*) FILTER (WHERE calstick_completed = true) AS completed,
          COUNT(*) FILTER (WHERE calstick_completed = false) AS not_completed,
          COUNT(*) AS total
        FROM paks_pad_stick_replies
        WHERE stick_id = $1 AND is_calstick = true`,
        [stickId]
      ),
      // Replies count (non-calstick)
      db.query(
        `SELECT COUNT(*) AS total
        FROM paks_pad_stick_replies
        WHERE stick_id = $1 AND (is_calstick = false OR is_calstick IS NULL)`,
        [stickId]
      ),
      // Noted pages count
      db.query(
        `SELECT COUNT(*) AS total FROM noted_pages WHERE stick_id = $1 OR personal_stick_id = $1`,
        [stickId]
      ),
      // Stick chats count
      db.query(
        `SELECT COUNT(*) AS total FROM stick_chat WHERE stick_id = $1`,
        [stickId]
      ),
      // Video rooms / meetings count
      db.query(
        `SELECT COUNT(*) AS total FROM meetings WHERE stick_id = $1`,
        [stickId]
      ),
      // Stick tabs count
      db.query(
        `SELECT COUNT(*) AS total FROM stick_tabs WHERE stick_id = $1`,
        [stickId]
      ),
    ])

    const calstickRow = calsticks.rows[0] || { completed: 0, not_completed: 0, total: 0 }

    return NextResponse.json({
      components: {
        calsticks: {
          total: Number(calstickRow.total),
          completed: Number(calstickRow.completed),
          notCompleted: Number(calstickRow.not_completed),
        },
        replies: {
          total: Number(replies.rows[0]?.total || 0),
        },
        noted: {
          total: Number(notedPages.rows[0]?.total || 0),
        },
        chats: {
          total: Number(chats.rows[0]?.total || 0),
        },
        videoRooms: {
          total: Number(videoRooms.rows[0]?.total || 0),
        },
        tabs: {
          total: Number(tabs.rows[0]?.total || 0),
        },
      },
    })
  } catch (err) {
    console.error("GET /api/sticks/[id]/map error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

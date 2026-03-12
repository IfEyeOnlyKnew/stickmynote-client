import { type NextRequest, NextResponse } from "next/server"
import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from "@/lib/auth/cached-auth"
import { validateCSRFMiddleware } from "@/lib/csrf"
import { db } from "@/lib/database/pg-client"

export const dynamic = "force-dynamic"

// ----------------------------------------------------------------------------
// POST - RSVP to a meeting (accept/decline/tentative)
// ----------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const isCSRFValid = await validateCSRFMiddleware(request)
  if (!isCSRFValid) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 })
  }

  try {
    const { user, error: authError } = await getCachedAuthUser()
    if (authError === "rate_limited") return createRateLimitResponse()
    if (!user) return createUnauthorizedResponse()

    const { meeting_id, status } = await request.json()

    if (!meeting_id) {
      return NextResponse.json({ error: "Meeting ID is required" }, { status: 400 })
    }

    const validStatuses = ["accepted", "declined", "tentative"]
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: "Invalid status. Must be: accepted, declined, or tentative" }, { status: 400 })
    }

    // Get user email
    const userResult = await db.query(
      `SELECT email FROM users WHERE id = $1`,
      [user.id]
    )
    const userEmail = userResult.rows[0]?.email

    if (!userEmail) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Update RSVP - match by user_id OR email
    const result = await db.query(
      `UPDATE meeting_attendees
       SET status = $1, responded_at = NOW(), user_id = COALESCE(user_id, $2)
       WHERE meeting_id = $3 AND (user_id = $2 OR LOWER(email) = LOWER($4))
       RETURNING *`,
      [status, user.id, meeting_id, userEmail]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "You are not an attendee of this meeting" }, { status: 404 })
    }

    return NextResponse.json({ attendee: result.rows[0] })
  } catch (error) {
    console.error("[Meeting RSVP] POST error:", error)
    return NextResponse.json({ error: "Failed to update RSVP" }, { status: 500 })
  }
}

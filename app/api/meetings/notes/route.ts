import { type NextRequest, NextResponse } from "next/server"
import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from "@/lib/auth/cached-auth"
import { validateCSRFMiddleware } from "@/lib/csrf"
import { db } from "@/lib/database/pg-client"

export const dynamic = "force-dynamic"

// ----------------------------------------------------------------------------
// GET - Fetch meeting notes for the current user
// ----------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await getCachedAuthUser()
    if (authError === "rate_limited") return createRateLimitResponse()
    if (!user) return createUnauthorizedResponse()

    const { searchParams } = new URL(request.url)
    const meetingId = searchParams.get("meeting_id")
    const limit = Number.parseInt(searchParams.get("limit") || "50", 10)
    const offset = Number.parseInt(searchParams.get("offset") || "0", 10)

    const conditions: string[] = ["mn.user_id = $1"]
    const values: any[] = [user.id]
    let idx = 2

    if (meetingId) {
      conditions.push(`mn.meeting_id = $${idx}`)
      values.push(meetingId)
      idx++
    }

    const result = await db.query(
      `SELECT mn.*,
        CASE WHEN m.id IS NOT NULL
          THEN json_build_object('id', m.id, 'title', m.title, 'start_time', m.start_time)
          ELSE NULL
        END as meeting,
        json_build_object('id', u.id, 'email', u.email, 'full_name', u.full_name) as author
       FROM meeting_notes mn
       LEFT JOIN meetings m ON mn.meeting_id = m.id
       LEFT JOIN users u ON mn.user_id = u.id
       WHERE ${conditions.join(" AND ")}
       ORDER BY mn.created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...values, limit, offset]
    )

    return NextResponse.json({ notes: result.rows })
  } catch (error) {
    console.error("[Meeting Notes] GET error:", error)
    return NextResponse.json({ error: "Failed to fetch meeting notes" }, { status: 500 })
  }
}

// ----------------------------------------------------------------------------
// POST - Create meeting notes
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

    const { title, content, meeting_id, pad_id, stick_id } = await request.json()

    if (!title?.trim()) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 })
    }

    const result = await db.query(
      `INSERT INTO meeting_notes (user_id, title, content, meeting_id, pad_id, stick_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        user.id,
        title.trim(),
        content?.trim() || null,
        meeting_id || null,
        pad_id || null,
        stick_id || null,
      ]
    )

    return NextResponse.json({ note: result.rows[0] })
  } catch (error) {
    console.error("[Meeting Notes] POST error:", error)
    return NextResponse.json({ error: "Failed to create meeting notes" }, { status: 500 })
  }
}

// ----------------------------------------------------------------------------
// PATCH - Update meeting notes
// ----------------------------------------------------------------------------

export async function PATCH(request: NextRequest) {
  const isCSRFValid = await validateCSRFMiddleware(request)
  if (!isCSRFValid) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 })
  }

  try {
    const { user, error: authError } = await getCachedAuthUser()
    if (authError === "rate_limited") return createRateLimitResponse()
    if (!user) return createUnauthorizedResponse()

    const { id, title, content } = await request.json()

    if (!id) {
      return NextResponse.json({ error: "Note ID is required" }, { status: 400 })
    }

    const updates: string[] = []
    const values: any[] = []
    let idx = 1

    if (title !== undefined) { updates.push(`title = $${idx++}`); values.push(title.trim()) }
    if (content !== undefined) { updates.push(`content = $${idx++}`); values.push(content?.trim() || null) }

    if (updates.length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 })
    }

    values.push(id, user.id)
    const result = await db.query(
      `UPDATE meeting_notes SET ${updates.join(", ")}
       WHERE id = $${idx} AND user_id = $${idx + 1}
       RETURNING *`,
      values
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 })
    }

    return NextResponse.json({ note: result.rows[0] })
  } catch (error) {
    console.error("[Meeting Notes] PATCH error:", error)
    return NextResponse.json({ error: "Failed to update meeting notes" }, { status: 500 })
  }
}

// ----------------------------------------------------------------------------
// DELETE - Delete meeting notes
// ----------------------------------------------------------------------------

export async function DELETE(request: NextRequest) {
  const isCSRFValid = await validateCSRFMiddleware(request)
  if (!isCSRFValid) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 })
  }

  try {
    const { user, error: authError } = await getCachedAuthUser()
    if (authError === "rate_limited") return createRateLimitResponse()
    if (!user) return createUnauthorizedResponse()

    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "Note ID is required" }, { status: 400 })
    }

    const result = await db.query(
      `DELETE FROM meeting_notes WHERE id = $1 AND user_id = $2 RETURNING id`,
      [id, user.id]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 })
    }

    return NextResponse.json({ deleted: true })
  } catch (error) {
    console.error("[Meeting Notes] DELETE error:", error)
    return NextResponse.json({ error: "Failed to delete meeting notes" }, { status: 500 })
  }
}

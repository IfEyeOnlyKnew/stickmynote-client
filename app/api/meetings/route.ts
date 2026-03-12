import { type NextRequest, NextResponse } from "next/server"
import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from "@/lib/auth/cached-auth"
import { validateCSRFMiddleware } from "@/lib/csrf"
import { db } from "@/lib/database/pg-client"
import { createVideoRoom } from "@/lib/livekit/rooms"
import { expandRecurrence } from "@/lib/meetings/recurrence"
import type { CreateMeetingRequest } from "@/types/meeting"

export const dynamic = "force-dynamic"

// Shared query fragment for fetching meetings with relations
const MEETING_SELECT = `
  SELECT DISTINCT m.*,
    json_build_object(
      'id', org.id,
      'email', org.email,
      'full_name', org.full_name,
      'avatar_url', org.avatar_url
    ) as organizer,
    COALESCE(
      (SELECT json_agg(json_build_object(
        'id', ma.id,
        'user_id', ma.user_id,
        'email', ma.email,
        'name', ma.name,
        'status', ma.status,
        'is_organizer', ma.is_organizer
      ))
      FROM meeting_attendees ma
      WHERE ma.meeting_id = m.id),
      '[]'
    ) as attendees,
    CASE WHEN sp.id IS NOT NULL THEN json_build_object('id', sp.id, 'name', sp.name) ELSE NULL END as pad,
    CASE WHEN ss.id IS NOT NULL THEN json_build_object('id', ss.id, 'topic', ss.topic) ELSE NULL END as stick
  FROM meetings m
  LEFT JOIN users org ON m.organizer_id = org.id
  LEFT JOIN meeting_attendees ma_user ON m.id = ma_user.meeting_id
  LEFT JOIN social_pads sp ON m.pad_id = sp.id
  LEFT JOIN social_sticks ss ON m.stick_id = ss.id
`

// ----------------------------------------------------------------------------
// GET - Fetch meetings for the current user (with recurring expansion)
// ----------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await getCachedAuthUser()
    if (authError === "rate_limited") return createRateLimitResponse()
    if (!user) return createUnauthorizedResponse()

    const { searchParams } = new URL(request.url)
    const start = searchParams.get("start")
    const end = searchParams.get("end")
    const padId = searchParams.get("pad_id")
    const stickId = searchParams.get("stick_id")
    const status = searchParams.get("status")
    const limit = searchParams.get("limit")
    const offset = searchParams.get("offset")

    // Build query dynamically
    const conditions: string[] = []
    const values: any[] = []
    let paramIndex = 1

    // User must be organizer or attendee
    conditions.push(`(m.organizer_id = $${paramIndex} OR ma_user.user_id = $${paramIndex + 1} OR LOWER(ma_user.email) = LOWER((SELECT email FROM users WHERE id = $${paramIndex + 2})))`)
    values.push(user.id, user.id, user.id)
    paramIndex += 3

    // Exclude child instances of recurring meetings from the main query —
    // we'll expand them from the parent in-memory
    conditions.push(`m.parent_meeting_id IS NULL`)

    // Date range filtering
    if (start && end) {
      // For non-recurring: overlap check. For recurring: parent created before range end
      conditions.push(`(
        (COALESCE(m.recurrence_type, 'none') = 'none' AND m.start_time < $${paramIndex} AND m.end_time > $${paramIndex + 1})
        OR (m.recurrence_type IS NOT NULL AND m.recurrence_type != 'none')
      )`)
      values.push(end, start)
      paramIndex += 2
    } else if (start) {
      conditions.push(`(m.end_time >= $${paramIndex} OR (m.recurrence_type IS NOT NULL AND m.recurrence_type != 'none'))`)
      values.push(start)
      paramIndex++
    } else if (end) {
      conditions.push(`m.start_time <= $${paramIndex}`)
      values.push(end)
      paramIndex++
    }

    if (padId) {
      conditions.push(`m.pad_id = $${paramIndex}`)
      values.push(padId)
      paramIndex++
    }
    if (stickId) {
      conditions.push(`m.stick_id = $${paramIndex}`)
      values.push(stickId)
      paramIndex++
    }
    if (status) {
      conditions.push(`m.status = $${paramIndex}`)
      values.push(status)
      paramIndex++
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : ""
    const limitClause = limit ? `LIMIT ${parseInt(limit, 10)}` : ""
    const offsetClause = offset ? `OFFSET ${parseInt(offset, 10)}` : ""

    const query = `
      ${MEETING_SELECT}
      ${whereClause}
      ORDER BY m.start_time ASC
      ${limitClause}
      ${offsetClause}
    `

    const result = await db.query(query, values)
    const dbMeetings = result.rows || []

    // Expand recurring meetings into virtual instances
    if (start && end) {
      const rangeStart = new Date(start)
      const rangeEnd = new Date(end)
      const expanded: any[] = []

      // Also fetch exception instances for recurring meetings in range
      const recurringParentIds = dbMeetings
        .filter((m: any) => m.recurrence_type && m.recurrence_type !== "none")
        .map((m: any) => m.id)

      let exceptions: any[] = []
      if (recurringParentIds.length > 0) {
        const excResult = await db.query(
          `SELECT instance_date FROM meetings
           WHERE parent_meeting_id = ANY($1) AND is_exception = true`,
          [recurringParentIds]
        )
        exceptions = excResult.rows.map((r: any) => r.instance_date)
      }

      for (const meeting of dbMeetings) {
        if (meeting.recurrence_type && meeting.recurrence_type !== "none") {
          // Expand recurrence
          const occurrences = expandRecurrence(meeting, rangeStart, rangeEnd)
          for (const occ of occurrences) {
            // Skip exceptions (they have their own modified instance row)
            if (exceptions.includes(occ.instanceDate)) continue

            expanded.push({
              ...meeting,
              start_time: occ.start.toISOString(),
              end_time: occ.end.toISOString(),
              instance_date: occ.instanceDate,
              _is_virtual_instance: true,
            })
          }
        } else {
          expanded.push(meeting)
        }
      }

      // Sort by start_time
      expanded.sort((a: any, b: any) =>
        new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
      )

      return NextResponse.json({ meetings: expanded })
    }

    return NextResponse.json({ meetings: dbMeetings })
  } catch (error) {
    console.error("[Meetings API] GET error:", error)
    return NextResponse.json({ error: "Failed to fetch meetings" }, { status: 500 })
  }
}

// ----------------------------------------------------------------------------
// POST - Create a new meeting (with optional recurrence)
// ----------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await getCachedAuthUser()
    if (authError === "rate_limited") return createRateLimitResponse()
    if (!user) return createUnauthorizedResponse()

    const body: CreateMeetingRequest = await request.json()
    const {
      title,
      description,
      start_time,
      end_time,
      attendee_emails = [],
      location,
      create_video_room = true,
      pad_id,
      stick_id,
      personal_stick_id,
      recurrence,
    } = body

    if (!title?.trim()) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 })
    }
    if (!start_time || !end_time) {
      return NextResponse.json({ error: "Start and end times are required" }, { status: 400 })
    }

    const startDate = new Date(start_time)
    const endDate = new Date(end_time)
    if (startDate >= endDate) {
      return NextResponse.json({ error: "End time must be after start time" }, { status: 400 })
    }

    // Get organizer info
    const userProfileResult = await db.query(
      `SELECT email, full_name, username FROM users WHERE id = $1`,
      [user.id]
    )
    const userProfile = userProfileResult.rows[0]

    // Create video room if requested
    let videoRoomId: string | null = null
    let videoRoomUrl: string | null = null

    if (create_video_room) {
      try {
        const room = await createVideoRoom(title, user.id)
        videoRoomId = room.id
        videoRoomUrl = room.room_url
      } catch (error) {
        console.error("[Meetings API] Error creating video room:", error)
      }
    }

    // Build recurrence columns
    const recurrenceType = recurrence?.type || "none"
    const recurrenceInterval = recurrence?.interval || 1
    const recurrenceDaysOfWeek = recurrence?.days_of_week?.length ? JSON.stringify(recurrence.days_of_week) : null
    const recurrenceDayOfMonth = recurrence?.day_of_month || null
    const recurrenceEndDate = recurrence?.end_date || null
    const recurrenceCount = recurrence?.count || null

    // Create the meeting
    const meetingResult = await db.query(
      `INSERT INTO meetings (
        title, description, organizer_id, start_time, end_time,
        video_room_id, video_room_url, location, status,
        pad_id, stick_id, personal_stick_id,
        recurrence_type, recurrence_interval, recurrence_days_of_week,
        recurrence_day_of_month, recurrence_end_date, recurrence_count
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      RETURNING *`,
      [
        title.trim(),
        description?.trim() || null,
        user.id,
        start_time,
        end_time,
        videoRoomId,
        videoRoomUrl,
        location?.trim() || null,
        "scheduled",
        pad_id || null,
        stick_id || null,
        personal_stick_id || null,
        recurrenceType,
        recurrenceInterval,
        recurrenceDaysOfWeek,
        recurrenceDayOfMonth,
        recurrenceEndDate,
        recurrenceCount,
      ]
    )

    const meeting = meetingResult.rows[0]
    if (!meeting) throw new Error("Failed to insert meeting")

    // Add organizer as attendee
    await db.query(
      `INSERT INTO meeting_attendees (meeting_id, user_id, email, name, status, is_organizer)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        meeting.id,
        user.id,
        userProfile?.email || user.email,
        userProfile?.full_name || userProfile?.username || null,
        "accepted",
        true,
      ]
    )

    // Add other attendees
    if (attendee_emails.length > 0) {
      const attendeeValues: any[] = []
      const attendeePlaceholders: string[] = []
      let paramIdx = 1

      for (const email of attendee_emails) {
        attendeePlaceholders.push(`($${paramIdx}, $${paramIdx + 1}, $${paramIdx + 2}, $${paramIdx + 3})`)
        attendeeValues.push(meeting.id, email.trim().toLowerCase(), "pending", false)
        paramIdx += 4
      }

      await db.query(
        `INSERT INTO meeting_attendees (meeting_id, email, status, is_organizer)
         VALUES ${attendeePlaceholders.join(", ")}`,
        attendeeValues
      )

      // Send invitation emails
      try {
        const organizerName = userProfile?.full_name || userProfile?.username || userProfile?.email || "Someone"
        const meetingDate = new Date(start_time).toLocaleDateString("en-US", {
          weekday: "long", year: "numeric", month: "long", day: "numeric",
        })
        const meetingTime = new Date(start_time).toLocaleTimeString("en-US", {
          hour: "2-digit", minute: "2-digit",
        })
        const endMeetingTime = new Date(end_time).toLocaleTimeString("en-US", {
          hour: "2-digit", minute: "2-digit",
        })

        const recurrenceNote = recurrenceType !== "none"
          ? `<p style="margin: 8px 0;"><strong>Recurrence:</strong> ${recurrenceType} meeting</p>`
          : ""

        await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/api/send-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: attendee_emails,
            subject: `Meeting Invitation: ${title}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #7c3aed;">Meeting Invitation</h2>
                <p><strong>${organizerName}</strong> has invited you to a meeting.</p>
                <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                  <h3 style="margin-top: 0; color: #1f2937;">${title}</h3>
                  <p style="margin: 8px 0;"><strong>Date:</strong> ${meetingDate}</p>
                  <p style="margin: 8px 0;"><strong>Time:</strong> ${meetingTime} - ${endMeetingTime}</p>
                  ${recurrenceNote}
                  ${location ? `<p style="margin: 8px 0;"><strong>Location:</strong> ${location}</p>` : ""}
                  ${description ? `<p style="margin: 8px 0;"><strong>Description:</strong> ${description}</p>` : ""}
                </div>
                ${videoRoomUrl ? `
                  <p>Join the video call:</p>
                  <a href="${videoRoomUrl}" style="display: inline-block; background-color: #7c3aed; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Join Video Call</a>
                  <p style="margin-top: 12px; color: #6b7280; font-size: 14px;">Or copy this link: <a href="${videoRoomUrl}">${videoRoomUrl}</a></p>
                ` : ""}
              </div>
            `,
          }),
        })
      } catch (emailError) {
        console.error("[Meetings API] Error sending invitations:", emailError)
      }
    }

    // Fetch the complete meeting with relations
    const completeMeetingResult = await db.query(
      `${MEETING_SELECT} WHERE m.id = $1`,
      [meeting.id]
    )

    return NextResponse.json({ meeting: completeMeetingResult.rows[0] || meeting })
  } catch (error) {
    console.error("[Meetings API] POST error:", error)
    return NextResponse.json({ error: "Failed to create meeting" }, { status: 500 })
  }
}

// ----------------------------------------------------------------------------
// PATCH - Update a meeting
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

    const body = await request.json()
    const { id, title, description, start_time, end_time, location, status } = body

    if (!id) {
      return NextResponse.json({ error: "Meeting ID is required" }, { status: 400 })
    }

    // Verify ownership
    const ownerCheck = await db.query(
      `SELECT id FROM meetings WHERE id = $1 AND organizer_id = $2`,
      [id, user.id]
    )
    if (ownerCheck.rows.length === 0) {
      return NextResponse.json({ error: "Meeting not found or not authorized" }, { status: 404 })
    }

    // Build update
    const updates: string[] = []
    const values: any[] = []
    let idx = 1

    if (title !== undefined) { updates.push(`title = $${idx++}`); values.push(title.trim()) }
    if (description !== undefined) { updates.push(`description = $${idx++}`); values.push(description?.trim() || null) }
    if (start_time !== undefined) { updates.push(`start_time = $${idx++}`); values.push(start_time) }
    if (end_time !== undefined) { updates.push(`end_time = $${idx++}`); values.push(end_time) }
    if (location !== undefined) { updates.push(`location = $${idx++}`); values.push(location?.trim() || null) }
    if (status !== undefined) { updates.push(`status = $${idx++}`); values.push(status) }

    if (updates.length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 })
    }

    values.push(id)
    await db.query(
      `UPDATE meetings SET ${updates.join(", ")} WHERE id = $${idx}`,
      values
    )

    const updated = await db.query(`${MEETING_SELECT} WHERE m.id = $1`, [id])
    return NextResponse.json({ meeting: updated.rows[0] })
  } catch (error) {
    console.error("[Meetings API] PATCH error:", error)
    return NextResponse.json({ error: "Failed to update meeting" }, { status: 500 })
  }
}

// ----------------------------------------------------------------------------
// DELETE - Cancel/delete a meeting
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
    const deleteSeries = searchParams.get("series") === "true"

    if (!id) {
      return NextResponse.json({ error: "Meeting ID is required" }, { status: 400 })
    }

    // Verify ownership
    const meeting = await db.query(
      `SELECT id, parent_meeting_id, recurrence_type FROM meetings WHERE id = $1 AND organizer_id = $2`,
      [id, user.id]
    )
    if (meeting.rows.length === 0) {
      return NextResponse.json({ error: "Meeting not found or not authorized" }, { status: 404 })
    }

    const meetingRow = meeting.rows[0]

    if (deleteSeries && meetingRow.recurrence_type && meetingRow.recurrence_type !== "none") {
      // Delete parent + all instances
      await db.query(`DELETE FROM meetings WHERE id = $1 OR parent_meeting_id = $1`, [id])
    } else if (meetingRow.parent_meeting_id) {
      // Delete single instance of a recurring meeting
      await db.query(`DELETE FROM meetings WHERE id = $1`, [id])
    } else {
      // Delete standalone meeting
      await db.query(`DELETE FROM meetings WHERE id = $1`, [id])
    }

    return NextResponse.json({ deleted: true })
  } catch (error) {
    console.error("[Meetings API] DELETE error:", error)
    return NextResponse.json({ error: "Failed to delete meeting" }, { status: 500 })
  }
}

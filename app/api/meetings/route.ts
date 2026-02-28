import { type NextRequest, NextResponse } from "next/server"
import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from "@/lib/auth/cached-auth"
import { db } from "@/lib/database/pg-client"
import { createVideoRoom } from "@/lib/livekit/rooms"
import type { CreateMeetingRequest } from "@/types/meeting"

export const dynamic = "force-dynamic"

// ----------------------------------------------------------------------------
// GET - Fetch meetings for the current user
// ----------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await getCachedAuthUser()

    if (authError === "rate_limited") {
      return createRateLimitResponse()
    }

    if (!user) {
      return createUnauthorizedResponse()
    }

    const { searchParams } = new URL(request.url)
    const start = searchParams.get("start")
    const end = searchParams.get("end")
    const padId = searchParams.get("pad_id")
    const stickId = searchParams.get("stick_id")
    const status = searchParams.get("status")
    const limit = searchParams.get("limit")
    const offset = searchParams.get("offset")

    console.log("[Meetings API] GET request:", {
      userId: user.id,
      start,
      end,
      padId,
      stickId,
      status,
    })

    // Build query dynamically
    const conditions: string[] = []
    const values: any[] = []
    let paramIndex = 1

    // User must be organizer or attendee (by user_id or email)
    // Use separate parameters to avoid casting issues
    conditions.push(`(m.organizer_id = $${paramIndex} OR ma_user.user_id = $${paramIndex + 1} OR LOWER(ma_user.email) = LOWER((SELECT email FROM users WHERE id = $${paramIndex + 2})))`)
    values.push(user.id, user.id, user.id)
    paramIndex += 3

    // For date range filtering, show meetings that overlap with the range
    // A meeting overlaps if: meeting.start < range.end AND meeting.end > range.start
    if (start && end) {
      conditions.push(`m.start_time < $${paramIndex}`)
      values.push(end)
      paramIndex++
      conditions.push(`m.end_time > $${paramIndex}`)
      values.push(start)
      paramIndex++
    } else if (start) {
      conditions.push(`m.end_time >= $${paramIndex}`)
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
      ${whereClause}
      ORDER BY m.start_time ASC
      ${limitClause}
      ${offsetClause}
    `

    console.log("[Meetings API] Query:", query)
    console.log("[Meetings API] Values:", values)

    const result = await db.query(query, values)

    console.log("[Meetings API] Found", result.rows?.length || 0, "meetings")

    // Debug: Also run a simple query to check if meetings exist at all
    if (result.rows?.length === 0) {
      console.log("[Meetings API] Debug - Current user ID:", user.id, "type:", typeof user.id)

      // Simple query: find meetings where user is organizer
      const organizerResult = await db.query(
        `SELECT m.id, m.title, m.organizer_id, m.start_time, m.end_time
         FROM meetings m
         WHERE m.organizer_id = $1
         ORDER BY m.start_time ASC
         LIMIT 10`,
        [user.id]
      )
      console.log("[Meetings API] Debug - Meetings where user is organizer:", organizerResult.rows)

      // Check all meetings regardless of date
      const allMeetingsResult = await db.query(
        `SELECT m.id, m.title, m.organizer_id, m.start_time, m.end_time,
                (SELECT email FROM users WHERE id = m.organizer_id) as organizer_email
         FROM meetings m
         ORDER BY m.start_time ASC
         LIMIT 10`
      )
      console.log("[Meetings API] Debug - All meetings in DB:", allMeetingsResult.rows)

      // Check meeting_attendees for this user
      const attendeesResult = await db.query(
        `SELECT ma.*, m.title as meeting_title
         FROM meeting_attendees ma
         JOIN meetings m ON ma.meeting_id = m.id
         WHERE ma.user_id = $1 OR ma.email = (SELECT email FROM users WHERE id = $1)
         LIMIT 10`,
        [user.id]
      )
      console.log("[Meetings API] Debug - Attendee entries for user:", attendeesResult.rows)
    }

    return NextResponse.json({ meetings: result.rows || [] })
  } catch (error) {
    console.error("[Meetings API] GET error:", error)
    return NextResponse.json({ error: "Failed to fetch meetings" }, { status: 500 })
  }
}

// ----------------------------------------------------------------------------
// POST - Create a new meeting
// ----------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await getCachedAuthUser()

    if (authError === "rate_limited") {
      return createRateLimitResponse()
    }

    if (!user) {
      return createUnauthorizedResponse()
    }

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
    } = body

    // Validate required fields
    if (!title?.trim()) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 })
    }
    if (!start_time || !end_time) {
      return NextResponse.json({ error: "Start and end times are required" }, { status: 400 })
    }

    // Validate time range
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
        // Continue without video room
      }
    }

    // Create the meeting
    const meetingResult = await db.query(
      `INSERT INTO meetings (
        title, description, organizer_id, start_time, end_time,
        video_room_id, video_room_url, location, status,
        pad_id, stick_id, personal_stick_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
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
      ]
    )

    const meeting = meetingResult.rows[0]

    if (!meeting) {
      throw new Error("Failed to insert meeting")
    }

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
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        })
        const meetingTime = new Date(start_time).toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
        })
        const endMeetingTime = new Date(end_time).toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
        })

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
                  ${location ? `<p style="margin: 8px 0;"><strong>Location:</strong> ${location}</p>` : ""}
                  ${description ? `<p style="margin: 8px 0;"><strong>Description:</strong> ${description}</p>` : ""}
                </div>

                ${
                  videoRoomUrl
                    ? `
                  <p>Join the video call:</p>
                  <a href="${videoRoomUrl}" style="display: inline-block; background-color: #7c3aed; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Join Video Call</a>
                  <p style="margin-top: 12px; color: #6b7280; font-size: 14px;">Or copy this link: <a href="${videoRoomUrl}">${videoRoomUrl}</a></p>
                `
                    : ""
                }
              </div>
            `,
          }),
        })
      } catch (emailError) {
        console.error("[Meetings API] Error sending invitations:", emailError)
        // Don't fail the meeting creation if email fails
      }
    }

    // Fetch the complete meeting with relations
    const completeMeetingResult = await db.query(
      `SELECT m.*,
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
        ) as attendees
       FROM meetings m
       LEFT JOIN users org ON m.organizer_id = org.id
       WHERE m.id = $1`,
      [meeting.id]
    )

    return NextResponse.json({ meeting: completeMeetingResult.rows[0] || meeting })
  } catch (error) {
    console.error("[Meetings API] POST error:", error)
    return NextResponse.json({ error: "Failed to create meeting" }, { status: 500 })
  }
}

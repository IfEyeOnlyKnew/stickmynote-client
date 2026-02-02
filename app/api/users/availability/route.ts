import { type NextRequest, NextResponse } from "next/server"
import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from "@/lib/auth/cached-auth"
import { db } from "@/lib/database/pg-client"

export const dynamic = "force-dynamic"

// ----------------------------------------------------------------------------
// GET - Fetch availability (busy times) for specified users
// Query params:
//   - user_ids: comma-separated list of user IDs
//   - emails: comma-separated list of emails (alternative to user_ids)
//   - start: ISO date string for range start
//   - end: ISO date string for range end
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
    const userIdsParam = searchParams.get("user_ids")
    const emailsParam = searchParams.get("emails")
    const start = searchParams.get("start")
    const end = searchParams.get("end")

    if (!start || !end) {
      return NextResponse.json(
        { error: "Start and end dates are required" },
        { status: 400 }
      )
    }

    if (!userIdsParam && !emailsParam) {
      return NextResponse.json(
        { error: "Either user_ids or emails parameter is required" },
        { status: 400 }
      )
    }

    // Parse user IDs or emails
    const userIds = userIdsParam ? userIdsParam.split(",").map((id) => id.trim()) : []
    const emails = emailsParam ? emailsParam.split(",").map((e) => e.trim().toLowerCase()) : []

    // Build query to get meetings for the specified users
    const conditions: string[] = []
    const values: any[] = []
    let paramIndex = 1

    // Date range filter (overlap logic)
    conditions.push(`m.start_time < $${paramIndex}`)
    values.push(end)
    paramIndex++
    conditions.push(`m.end_time > $${paramIndex}`)
    values.push(start)
    paramIndex++

    // Only include scheduled or in_progress meetings (not cancelled)
    conditions.push(`m.status IN ('scheduled', 'in_progress')`)

    // User filter - either by user_id in meeting_attendees or organizer_id
    if (userIds.length > 0) {
      const userIdPlaceholders = userIds.map((_, i) => `$${paramIndex + i}`).join(", ")
      conditions.push(`(m.organizer_id IN (${userIdPlaceholders}) OR ma.user_id IN (${userIdPlaceholders}))`)
      values.push(...userIds, ...userIds)
      paramIndex += userIds.length * 2
    } else if (emails.length > 0) {
      // Look up user IDs from emails first, then also check meeting_attendees.email
      const emailPlaceholders = emails.map((_, i) => `$${paramIndex + i}`).join(", ")
      conditions.push(`(
        ma.email IN (${emailPlaceholders})
        OR m.organizer_id IN (SELECT id FROM users WHERE LOWER(email) IN (${emailPlaceholders}))
        OR ma.user_id IN (SELECT id FROM users WHERE LOWER(email) IN (${emailPlaceholders}))
      )`)
      values.push(...emails, ...emails, ...emails)
      paramIndex += emails.length * 3
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : ""

    const query = `
      SELECT DISTINCT
        m.id,
        m.title,
        m.start_time,
        m.end_time,
        m.organizer_id,
        COALESCE(org.email, '') as organizer_email,
        COALESCE(org.full_name, org.username, org.email) as organizer_name,
        ma.user_id as attendee_user_id,
        ma.email as attendee_email
      FROM meetings m
      LEFT JOIN users org ON m.organizer_id = org.id
      LEFT JOIN meeting_attendees ma ON m.id = ma.meeting_id
      ${whereClause}
      ORDER BY m.start_time ASC
    `

    const result = await db.query(query, values)

    // Group busy times by user email
    const busyTimesByUser: Record<string, Array<{
      id: string
      title: string
      start_time: string
      end_time: string
      is_organizer: boolean
    }>> = {}

    for (const row of result.rows || []) {
      // Determine which user(s) this meeting affects
      const affectedEmails: string[] = []

      // Check organizer
      if (row.organizer_email) {
        affectedEmails.push(row.organizer_email.toLowerCase())
      }

      // Check attendee
      if (row.attendee_email) {
        affectedEmails.push(row.attendee_email.toLowerCase())
      }

      // Filter to only requested emails/users
      const relevantEmails = affectedEmails.filter((email) => {
        if (emails.length > 0) {
          return emails.includes(email)
        }
        return true // If using user_ids, include all
      })

      for (const email of relevantEmails) {
        if (!busyTimesByUser[email]) {
          busyTimesByUser[email] = []
        }

        // Avoid duplicates
        const exists = busyTimesByUser[email].some((bt) => bt.id === row.id)
        if (!exists) {
          busyTimesByUser[email].push({
            id: row.id,
            title: row.title,
            start_time: row.start_time,
            end_time: row.end_time,
            is_organizer: row.organizer_email?.toLowerCase() === email,
          })
        }
      }
    }

    return NextResponse.json({
      availability: busyTimesByUser,
      range: { start, end },
    })
  } catch (error) {
    console.error("[User Availability API] GET error:", error)
    return NextResponse.json(
      { error: "Failed to fetch user availability" },
      { status: 500 }
    )
  }
}

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

interface BusyTime {
  id: string
  title: string
  start_time: string
  end_time: string
  is_organizer: boolean
}

function groupBusyTimesByUser(
  rows: any[],
  requestedEmails: string[],
): Record<string, BusyTime[]> {
  const result: Record<string, BusyTime[]> = {}

  for (const row of rows) {
    const affectedEmails = collectAffectedEmails(row)
    const relevantEmails = requestedEmails.length > 0
      ? affectedEmails.filter((e) => requestedEmails.includes(e))
      : affectedEmails

    for (const email of relevantEmails) {
      if (!result[email]) result[email] = []
      const exists = result[email].some((bt) => bt.id === row.id)
      if (exists) continue
      result[email].push({
        id: row.id,
        title: row.title,
        start_time: row.start_time,
        end_time: row.end_time,
        is_organizer: row.organizer_email?.toLowerCase() === email,
      })
    }
  }

  return result
}

function addUserFilter(
  conditions: string[],
  values: any[],
  paramIndex: number,
  userIds: string[],
  emails: string[],
): number {
  if (userIds.length > 0) {
    const placeholders = userIds.map((_, i) => `$${paramIndex + i}`).join(", ")
    conditions.push(`(m.organizer_id IN (${placeholders}) OR ma.user_id IN (${placeholders}))`)
    values.push(...userIds, ...userIds)
    return paramIndex + userIds.length * 2
  }

  if (emails.length > 0) {
    const placeholders = emails.map((_, i) => `$${paramIndex + i}`).join(", ")
    conditions.push(`(
      ma.email IN (${placeholders})
      OR m.organizer_id IN (SELECT id FROM users WHERE LOWER(email) IN (${placeholders}))
      OR ma.user_id IN (SELECT id FROM users WHERE LOWER(email) IN (${placeholders}))
    )`)
    values.push(...emails, ...emails, ...emails)
    return paramIndex + emails.length * 3
  }

  return paramIndex
}

function collectAffectedEmails(row: any): string[] {
  const emails: string[] = []
  if (row.organizer_email) emails.push(row.organizer_email.toLowerCase())
  if (row.attendee_email) emails.push(row.attendee_email.toLowerCase())
  return emails
}

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
    paramIndex = addUserFilter(conditions, values, paramIndex, userIds, emails)

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

    const busyTimesByUser = groupBusyTimesByUser(result.rows || [], emails)

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

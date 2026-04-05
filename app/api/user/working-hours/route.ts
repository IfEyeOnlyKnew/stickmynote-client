import { type NextRequest, NextResponse } from "next/server"
import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from "@/lib/auth/cached-auth"
import { db } from "@/lib/database/pg-client"
import type { WorkingHours, UpdateWorkingHoursRequest } from "@/types/user-status"

/**
 * USER WORKING HOURS API
 *
 * Manages user working hours schedule for auto-away status.
 */

// ----------------------------------------------------------------------------
// GET /api/user/working-hours
// ----------------------------------------------------------------------------
// Get current user's working hours configuration

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await getCachedAuthUser()

    if (authError === "rate_limited") {
      return createRateLimitResponse()
    }

    if (!user) {
      return createUnauthorizedResponse()
    }

    const result = await db.query(`SELECT * FROM user_working_hours WHERE user_id = $1`, [user.id])

    if (result.rows.length === 0) {
      // Return defaults
      return NextResponse.json({
        workingHours: {
          user_id: user.id,
          enabled: false,
          timezone: "America/New_York",
          monday_start: "09:00",
          monday_end: "17:00",
          tuesday_start: "09:00",
          tuesday_end: "17:00",
          wednesday_start: "09:00",
          wednesday_end: "17:00",
          thursday_start: "09:00",
          thursday_end: "17:00",
          friday_start: "09:00",
          friday_end: "17:00",
          saturday_start: null,
          saturday_end: null,
          sunday_start: null,
          sunday_end: null,
          away_message: "I'm currently outside my working hours. I'll respond when I'm back.",
        },
      })
    }

    return NextResponse.json({ workingHours: result.rows[0] })
  } catch (error) {
    console.error("[WorkingHours] GET error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// ----------------------------------------------------------------------------
// PUT /api/user/working-hours
// ----------------------------------------------------------------------------
// Update current user's working hours configuration

const TIME_FIELDS = [
  "monday_start", "monday_end", "tuesday_start", "tuesday_end",
  "wednesday_start", "wednesday_end", "thursday_start", "thursday_end",
  "friday_start", "friday_end", "saturday_start", "saturday_end",
  "sunday_start", "sunday_end",
] as const

const TIME_REGEX = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/

function validateTimeFields(body: any): string | null {
  for (const field of TIME_FIELDS) {
    const value = body[field]
    if (value != null && !TIME_REGEX.test(value as string)) {
      return field
    }
  }
  return null
}

export async function PUT(request: NextRequest) {
  try {
    const { user, error: authError } = await getCachedAuthUser()

    if (authError === "rate_limited") {
      return createRateLimitResponse()
    }

    if (!user) {
      return createUnauthorizedResponse()
    }

    const body: UpdateWorkingHoursRequest = await request.json()

    // Validate time formats if provided
    const invalidField = validateTimeFields(body)
    if (invalidField) {
      return NextResponse.json({ error: `Invalid time format for ${invalidField}` }, { status: 400 })
    }

    // Check if record exists
    const existingResult = await db.query(`SELECT id FROM user_working_hours WHERE user_id = $1`, [user.id])

    let updatedHours: WorkingHours

    if (existingResult.rows.length === 0) {
      // Insert new record
      const insertResult = await db.query(
        `INSERT INTO user_working_hours (
          user_id,
          enabled,
          timezone,
          monday_start, monday_end,
          tuesday_start, tuesday_end,
          wednesday_start, wednesday_end,
          thursday_start, thursday_end,
          friday_start, friday_end,
          saturday_start, saturday_end,
          sunday_start, sunday_end,
          away_message
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
        RETURNING *`,
        [
          user.id,
          body.enabled ?? false,
          body.timezone ?? "America/New_York",
          body.monday_start ?? "09:00",
          body.monday_end ?? "17:00",
          body.tuesday_start ?? "09:00",
          body.tuesday_end ?? "17:00",
          body.wednesday_start ?? "09:00",
          body.wednesday_end ?? "17:00",
          body.thursday_start ?? "09:00",
          body.thursday_end ?? "17:00",
          body.friday_start ?? "09:00",
          body.friday_end ?? "17:00",
          body.saturday_start ?? null,
          body.saturday_end ?? null,
          body.sunday_start ?? null,
          body.sunday_end ?? null,
          body.away_message ?? "I'm currently outside my working hours. I'll respond when I'm back.",
        ]
      )
      updatedHours = insertResult.rows[0]
    } else {
      // Build dynamic update query
      const updates: string[] = []
      const values: any[] = []
      let paramIndex = 1

      const fields: (keyof UpdateWorkingHoursRequest)[] = [
        "enabled",
        "timezone",
        "monday_start",
        "monday_end",
        "tuesday_start",
        "tuesday_end",
        "wednesday_start",
        "wednesday_end",
        "thursday_start",
        "thursday_end",
        "friday_start",
        "friday_end",
        "saturday_start",
        "saturday_end",
        "sunday_start",
        "sunday_end",
        "away_message",
      ]

      for (const field of fields) {
        if (body[field] !== undefined) {
          updates.push(`${field} = $${paramIndex++}`)
          values.push(body[field])
        }
      }

      if (updates.length === 0) {
        return NextResponse.json({ error: "No fields to update" }, { status: 400 })
      }

      values.push(user.id)

      const updateResult = await db.query(
        `UPDATE user_working_hours
         SET ${updates.join(", ")}, updated_at = NOW()
         WHERE user_id = $${paramIndex}
         RETURNING *`,
        values
      )
      updatedHours = updateResult.rows[0]
    }

    return NextResponse.json({ workingHours: updatedHours })
  } catch (error) {
    console.error("[WorkingHours] PUT error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

import { type NextRequest, NextResponse } from "next/server"
import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from "@/lib/auth/cached-auth"
import { db } from "@/lib/database/pg-client"
import { publishToOrg } from "@/lib/ws/publish-event"
import { getOrgContext } from "@/lib/auth/get-org-context"
import type {
  UserStatus,
  EffectiveUserStatus,
  UpdateStatusRequest,
  UserStatusType,
} from "@/types/user-status"

/**
 * USER STATUS API
 *
 * Manages user status (online/away/busy/dnd), custom messages,
 * focus mode, and related presence features.
 */

// Online threshold in minutes - users seen within this time are considered online
const ONLINE_THRESHOLD_MINUTES = 5

// ----------------------------------------------------------------------------
// GET /api/user/status
// ----------------------------------------------------------------------------
// Get status for the current user, or multiple users via ?ids=
//
// Query params:
//   - ids: comma-separated list of user IDs (optional, returns multiple statuses)
//
// Returns:
//   - Single user: { status, effective }
//   - Multiple users: { statuses: { [userId]: EffectiveUserStatus } }

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await getCachedAuthUser()

    if (authError === "rate_limited") {
      return createRateLimitResponse()
    }

    if (!user) {
      return createUnauthorizedResponse()
    }

    const searchParams = request.nextUrl.searchParams
    const idsParam = searchParams.get("ids")

    // Multiple users mode
    if (idsParam) {
      const userIds = idsParam
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean)

      if (userIds.length === 0) {
        return NextResponse.json({ statuses: {} })
      }

      if (userIds.length > 100) {
        return NextResponse.json({ error: "Maximum 100 user IDs allowed" }, { status: 400 })
      }

      const statuses = await getMultipleUserStatuses(userIds)
      return NextResponse.json({ statuses })
    }

    // Single user mode (current user)
    const status = await getUserStatus(user.id)
    const effective = await getEffectiveStatus(user.id, status)

    return NextResponse.json({ status, effective })
  } catch (error) {
    console.error("[UserStatus] GET error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// ----------------------------------------------------------------------------
// PUT /api/user/status
// ----------------------------------------------------------------------------
// Update current user's status

export async function PUT(request: NextRequest) {
  try {
    const { user, error: authError } = await getCachedAuthUser()

    if (authError === "rate_limited") {
      return createRateLimitResponse()
    }

    if (!user) {
      return createUnauthorizedResponse()
    }

    const body: UpdateStatusRequest = await request.json()

    const validationError = validateStatusUpdate(body)
    if (validationError) return validationError

    const updatedStatus = await upsertUserStatus(user.id, body)
    if (!updatedStatus) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 })
    }

    const effective = await getEffectiveStatus(user.id, updatedStatus)
    await broadcastStatusChange(user.id, updatedStatus, effective)

    return NextResponse.json({ status: updatedStatus, effective })
  } catch (error) {
    console.error("[UserStatus] PUT error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// ----------------------------------------------------------------------------
// POST /api/user/status
// ----------------------------------------------------------------------------
// Quick status change - just updates the status field

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await getCachedAuthUser()

    if (authError === "rate_limited") {
      return createRateLimitResponse()
    }

    if (!user) {
      return createUnauthorizedResponse()
    }

    const body = await request.json()
    const { status } = body

    if (!status || !VALID_STATUSES.has(status)) {
      return NextResponse.json({ error: "Invalid status value" }, { status: 400 })
    }

    const result = await db.query(
      `INSERT INTO user_status (user_id, status)
       VALUES ($1, $2)
       ON CONFLICT (user_id)
       DO UPDATE SET status = $2, updated_at = NOW()
       RETURNING *`,
      [user.id, status]
    )

    const updatedStatus = result.rows[0]
    const effective = await getEffectiveStatus(user.id, updatedStatus)
    await broadcastStatusChange(user.id, updatedStatus, effective)

    return NextResponse.json({ status: updatedStatus, effective })
  } catch (error) {
    console.error("[UserStatus] POST error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// ----------------------------------------------------------------------------
// Validation & Upsert Helpers
// ----------------------------------------------------------------------------

const VALID_STATUSES = new Set(["online", "away", "busy", "dnd", "offline"])

function validateStatusUpdate(body: UpdateStatusRequest): NextResponse | null {
  if (body.status && !VALID_STATUSES.has(body.status)) {
    return NextResponse.json({ error: "Invalid status value" }, { status: 400 })
  }
  if (body.custom_message && body.custom_message.length > 100) {
    return NextResponse.json({ error: "Custom message must be 100 characters or less" }, { status: 400 })
  }
  return null
}

async function insertNewStatus(userId: string, body: UpdateStatusRequest): Promise<UserStatus> {
  const insertResult = await db.query(
    `INSERT INTO user_status (
      user_id, status, custom_message, custom_message_expires_at,
      focus_mode_enabled, focus_mode_expires_at,
      auto_away_enabled, auto_away_minutes, calendar_sync_enabled
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *`,
    [
      userId,
      body.status ?? "online",
      body.custom_message ?? null,
      body.custom_message_expires_at ?? null,
      body.focus_mode_enabled ?? false,
      body.focus_mode_expires_at ?? null,
      body.auto_away_enabled ?? true,
      body.auto_away_minutes ?? 15,
      body.calendar_sync_enabled ?? true,
    ]
  )
  return insertResult.rows[0]
}

function buildUpdateQuery(body: UpdateStatusRequest): { updates: string[]; values: unknown[] } | null {
  const updatableFields = [
    "status", "custom_message", "custom_message_expires_at",
    "focus_mode_enabled", "focus_mode_expires_at",
    "auto_away_enabled", "auto_away_minutes", "calendar_sync_enabled",
  ] as const

  const updates: string[] = []
  const values: unknown[] = []
  let paramIndex = 1

  for (const field of updatableFields) {
    if (body[field] !== undefined) {
      updates.push(`${field} = $${paramIndex++}`)
      values.push(body[field])
    }
  }

  if (updates.length === 0) return null
  return { updates, values }
}

async function updateExistingStatus(userId: string, body: UpdateStatusRequest): Promise<UserStatus | null> {
  const queryParts = buildUpdateQuery(body)
  if (!queryParts) return null

  const { updates, values } = queryParts
  values.push(userId)

  const updateResult = await db.query(
    `UPDATE user_status
     SET ${updates.join(", ")}, updated_at = NOW()
     WHERE user_id = $${values.length}
     RETURNING *`,
    values
  )
  return updateResult.rows[0]
}

async function upsertUserStatus(userId: string, body: UpdateStatusRequest): Promise<UserStatus | null> {
  const existingResult = await db.query(`SELECT id FROM user_status WHERE user_id = $1`, [userId])

  if (existingResult.rows.length === 0) {
    return insertNewStatus(userId, body)
  }
  return updateExistingStatus(userId, body)
}

async function broadcastStatusChange(userId: string, updatedStatus: UserStatus, effective: EffectiveUserStatus): Promise<void> {
  try {
    const orgContext = await getOrgContext()
    if (orgContext) {
      publishToOrg(orgContext.orgId, {
        type: "status.update",
        payload: { userId, status: updatedStatus, effective },
        timestamp: Date.now(),
      })
    }
  } catch {
    // Non-critical
  }
}

// ----------------------------------------------------------------------------
// Helper Functions
// ----------------------------------------------------------------------------

async function getUserStatus(userId: string): Promise<UserStatus | null> {
  const result = await db.query(`SELECT * FROM user_status WHERE user_id = $1`, [userId])
  return result.rows[0] || null
}

async function getEffectiveStatus(userId: string, storedStatus: UserStatus | null): Promise<EffectiveUserStatus> {
  const userResult = await db.query(`SELECT last_seen_at FROM users WHERE id = $1`, [userId])
  const lastSeenAt = userResult.rows[0]?.last_seen_at || null
  const isOnline = isUserOnline(lastSeenAt)
  const inMeeting = await checkIfInMeeting(userId)
  const withinWorkingHours = await checkWorkingHours(userId)

  return resolveEffectiveStatus(userId, storedStatus, isOnline, inMeeting, withinWorkingHours, lastSeenAt)
}

function isUserOnline(lastSeenAt: string | null): boolean {
  return !!lastSeenAt && new Date(lastSeenAt) > new Date(Date.now() - ONLINE_THRESHOLD_MINUTES * 60 * 1000)
}

function isFocusModeActive(storedStatus: UserStatus | Record<string, unknown>): boolean {
  if (!storedStatus.focus_mode_enabled) return false
  const expiresAt = storedStatus.focus_mode_expires_at as string | null
  return !expiresAt || new Date(expiresAt) > new Date()
}

function determineEffectiveStatus(
  storedStatus: UserStatus | Record<string, unknown>,
  focusMode: boolean,
  inMeeting: boolean,
  withinWorkingHours: boolean,
): { status: UserStatusType; message: string | null } {
  if (focusMode) return { status: "dnd", message: null }

  const calendarSyncEnabled = storedStatus.calendar_sync_enabled !== false
  if (inMeeting && calendarSyncEnabled) return { status: "busy", message: "In a meeting" }
  if (!withinWorkingHours && storedStatus.auto_away_enabled) return { status: "away", message: null }

  return { status: storedStatus.status as UserStatusType, message: null }
}

function getActiveCustomMessage(storedStatus: UserStatus | Record<string, unknown>): string | null {
  const message = storedStatus.custom_message as string | null
  if (!message) return null

  const expiresAt = storedStatus.custom_message_expires_at as string | null
  const notExpired = !expiresAt || new Date(expiresAt) > new Date()
  return notExpired ? message : null
}

function resolveEffectiveStatus(
  userId: string,
  storedStatus: UserStatus | Record<string, unknown> | null,
  isOnline: boolean,
  inMeeting: boolean,
  withinWorkingHours: boolean,
  lastSeenAt: string | null,
): EffectiveUserStatus {
  if (!isOnline) {
    return buildEffectiveStatus(userId, "offline", null, false, withinWorkingHours, isOnline, lastSeenAt)
  }

  if (!storedStatus?.status) {
    return buildEffectiveStatus(userId, "online", null, false, withinWorkingHours, isOnline, lastSeenAt)
  }

  const focusMode = isFocusModeActive(storedStatus)
  const { status: effectiveStatus, message } = determineEffectiveStatus(storedStatus, focusMode, inMeeting, withinWorkingHours)
  const customMessage = getActiveCustomMessage(storedStatus) ?? message

  return buildEffectiveStatus(userId, effectiveStatus, customMessage, focusMode, withinWorkingHours, isOnline, lastSeenAt)
}

function buildEffectiveStatus(
  userId: string,
  status: UserStatusType,
  customMessage: string | null,
  focusModeEnabled: boolean,
  withinWorkingHours: boolean,
  isOnline: boolean,
  lastSeenAt: string | null,
): EffectiveUserStatus {
  return {
    user_id: userId,
    status,
    custom_message: customMessage,
    focus_mode_enabled: focusModeEnabled,
    is_within_working_hours: withinWorkingHours,
    is_online: isOnline,
    last_seen_at: lastSeenAt,
  }
}

function buildRowMap(rows: Record<string, unknown>[]): Record<string, Record<string, unknown>> {
  const map: Record<string, Record<string, unknown>> = {}
  for (const row of rows) {
    const key = (row.id || row.user_id) as string
    map[key] = row
  }
  return map
}

function buildWorkingHoursMap(rows: Record<string, unknown>[]): Record<string, Record<string, unknown>> {
  const map: Record<string, Record<string, unknown>> = {}
  for (const row of rows) {
    map[row.user_id as string] = row
  }
  return map
}

function resolveStatusForUser(
  userId: string,
  row: Record<string, unknown> | undefined,
  meetingUserIds: Set<string>,
  workingHoursMap: Record<string, Record<string, unknown>>,
): EffectiveUserStatus {
  const lastSeenAt = (row?.last_seen_at as string) || null
  const inMeeting = meetingUserIds.has(userId)
  const workingHours = workingHoursMap[userId]
  const withinWorkingHours = workingHours ? checkWorkingHoursSync(workingHours) : true

  return resolveEffectiveStatus(userId, row ?? null, isUserOnline(lastSeenAt), inMeeting, withinWorkingHours, lastSeenAt)
}

async function getMultipleUserStatuses(userIds: string[]): Promise<Record<string, EffectiveUserStatus>> {
  const statusResult = await db.query(
    `SELECT us.*, u.last_seen_at
     FROM users u
     LEFT JOIN user_status us ON u.id = us.user_id
     WHERE u.id = ANY($1)`,
    [userIds]
  )

  const rowMap = buildRowMap(statusResult.rows)

  const workingHoursResult = await db.query(
    `SELECT * FROM user_working_hours WHERE user_id = ANY($1)`,
    [userIds]
  )
  const workingHoursMap = buildWorkingHoursMap(workingHoursResult.rows)
  const meetingUserIds = await checkMultipleUsersInMeetings(userIds)

  const statuses: Record<string, EffectiveUserStatus> = {}
  for (const userId of userIds) {
    statuses[userId] = resolveStatusForUser(userId, rowMap[userId], meetingUserIds, workingHoursMap)
  }
  return statuses
}

async function checkIfInMeeting(userId: string): Promise<boolean> {
  try {
    const result = await db.query(
      `SELECT COUNT(*) as count
       FROM calendar_events ce
       WHERE ce.user_id = $1
         AND ce.start_time <= NOW()
         AND ce.end_time >= NOW()`,
      [userId]
    )
    return Number.parseInt(result.rows[0]?.count || "0", 10) > 0
  } catch {
    // Table might not exist yet
    return false
  }
}

async function checkMultipleUsersInMeetings(userIds: string[]): Promise<Set<string>> {
  try {
    const result = await db.query(
      `SELECT DISTINCT user_id
       FROM calendar_events
       WHERE user_id = ANY($1)
         AND start_time <= NOW()
         AND end_time >= NOW()`,
      [userIds]
    )
    return new Set(result.rows.map((r) => r.user_id))
  } catch {
    return new Set()
  }
}

async function checkWorkingHours(userId: string): Promise<boolean> {
  try {
    const result = await db.query(`SELECT * FROM user_working_hours WHERE user_id = $1`, [userId])
    const workingHours = result.rows[0]

    if (!workingHours?.enabled) {
      return true // No working hours configured = always available
    }

    return checkWorkingHoursSync(workingHours)
  } catch {
    return true
  }
}

function checkWorkingHoursSync(workingHours: any): boolean {
  if (!workingHours.enabled) return true

  const timezone = workingHours.timezone || "America/New_York"
  const now = new Date()

  // Get current day and time in user's timezone
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })

  const parts = formatter.formatToParts(now)
  const weekday = parts.find((p) => p.type === "weekday")?.value?.toLowerCase()
  const hour = parts.find((p) => p.type === "hour")?.value || "00"
  const minute = parts.find((p) => p.type === "minute")?.value || "00"
  const currentTime = `${hour}:${minute}`

  // Get start/end for current day
  const startKey = `${weekday}_start`
  const endKey = `${weekday}_end`
  const dayStart = workingHours[startKey]
  const dayEnd = workingHours[endKey]

  if (!dayStart || !dayEnd) {
    return false // Not working this day
  }

  return currentTime >= dayStart && currentTime <= dayEnd
}

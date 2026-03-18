import { createDatabaseClient, createServiceDatabaseClient } from "@/lib/database/database-adapter"
import { NextResponse } from "next/server"
import { getOrgContext, type OrgContext } from "@/lib/auth/get-org-context"
import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from "@/lib/auth/cached-auth"
import { isUnderLegalHold } from "@/lib/legal-hold/check-hold"

// ============================================================================
// Types
// ============================================================================

type User = {
  id: string
  full_name: string | null
  username: string | null
  email: string | null
  avatar_url: string | null
}

type AuthenticatedContext = {
  user: { id: string; email?: string }
  orgContext: OrgContext
}

type StickWithPad = {
  user_id: string
  social_pad_id: string
  social_pads: { id?: string; name?: string; owner_id: string } | { id?: string; name?: string; owner_id: string }[] | null
}

// ============================================================================
// Constants
// ============================================================================

const USER_SELECT_FIELDS = "id, full_name, username, email, avatar_url"
const LOG_PREFIX = "[InferenceStick]"

// Simple select without Supabase-style joins - fetch related data separately
const STICK_SELECT = "*"
const STICK_ACCESS_SELECT = "user_id, social_pad_id"

// ============================================================================
// Error Responses
// ============================================================================

const Errors = {
  rateLimit: () => createRateLimitResponse(),
  unauthorized: () => createUnauthorizedResponse(),
  orgRequired: () => NextResponse.json({ error: "Organization context required" }, { status: 401 }),
  stickNotFound: () => NextResponse.json({ error: "Stick not found" }, { status: 404 }),
  invalidStick: () => NextResponse.json({ error: "Invalid stick data" }, { status: 500 }),
  accessDenied: () => NextResponse.json({ error: "Access denied" }, { status: 403 }),
  permissionDenied: () => NextResponse.json({ error: "Permission denied" }, { status: 403 }),
  fetchFailed: () => NextResponse.json({ error: "Failed to fetch social stick" }, { status: 500 }),
  updateFailed: () => NextResponse.json({ error: "Failed to update social stick" }, { status: 500 }),
  deleteFailed: () => NextResponse.json({ error: "Failed to delete social stick" }, { status: 500 }),
}

// ============================================================================
// Auth Helpers
// ============================================================================

async function getAuthenticatedContext(): Promise<
  | { success: true; context: AuthenticatedContext }
  | { success: false; response: NextResponse }
> {
  const authResult = await getCachedAuthUser()
  if (authResult.rateLimited) {
    return { success: false, response: Errors.rateLimit() }
  }
  if (!authResult.user) {
    return { success: false, response: Errors.unauthorized() }
  }

  let orgContext: OrgContext | null
  try {
    orgContext = await getOrgContext()
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg === "RATE_LIMITED") {
      return { success: false, response: Errors.rateLimit() }
    }
    throw err
  }

  if (!orgContext) {
    return { success: false, response: Errors.orgRequired() }
  }

  return { success: true, context: { user: authResult.user, orgContext } }
}

// ============================================================================
// Data Helpers
// ============================================================================

function extractPadInfo(stick: StickWithPad): { padId: string; padOwnerId: string | undefined } {
  const padInfo = Array.isArray(stick.social_pads) ? stick.social_pads[0] : stick.social_pads
  return {
    padId: padInfo?.id || stick.social_pad_id,
    padOwnerId: padInfo?.owner_id,
  }
}

async function fetchUserMap(db: any, userIds: string[]): Promise<Record<string, User>> {
  if (userIds.length === 0) return {}

  const { data: users } = await db
    .from("users")
    .select(USER_SELECT_FIELDS)
    .in("id", userIds)

  if (!users) return {}

  return (users as User[]).reduce((acc, u) => {
    acc[u.id] = u
    return acc
  }, {} as Record<string, User>)
}

// ============================================================================
// Database Operations
// ============================================================================

async function fetchStick(db: any, stickId: string, orgId: string) {
  const { data: stick, error } = await db
    .from("social_sticks")
    .select(STICK_SELECT)
    .eq("id", stickId)
    .eq("org_id", orgId)
    .maybeSingle()

  if (error || !stick) {
    return { data: stick, error }
  }

  // Fetch pad info separately
  if (stick.social_pad_id) {
    const { data: pad } = await db
      .from("social_pads")
      .select("id, name, owner_id")
      .eq("id", stick.social_pad_id)
      .maybeSingle()
    stick.social_pads = pad
  }

  return { data: stick, error: null }
}

async function fetchStickForAccess(db: any, stickId: string, orgId: string) {
  const { data: stick, error } = await db
    .from("social_sticks")
    .select(STICK_ACCESS_SELECT)
    .eq("id", stickId)
    .eq("org_id", orgId)
    .maybeSingle()

  if (error || !stick) {
    return { data: stick, error }
  }

  // Fetch pad owner separately
  if (stick.social_pad_id) {
    const { data: pad } = await db
      .from("social_pads")
      .select("owner_id")
      .eq("id", stick.social_pad_id)
      .maybeSingle()
    stick.social_pads = pad
  }

  return { data: stick, error: null }
}

async function fetchMembership(db: any, padId: string, userId: string, orgId: string) {
  return db
    .from("social_pad_members")
    .select("role")
    .eq("social_pad_id", padId)
    .eq("user_id", userId)
    .eq("accepted", true)
    .eq("org_id", orgId)
    .maybeSingle()
}

async function fetchDetailsTab(db: any, stickId: string, orgId: string): Promise<string> {
  const { data } = await db
    .from("social_stick_tabs")
    .select("tab_data")
    .eq("social_stick_id", stickId)
    .eq("tab_type", "details")
    .eq("org_id", orgId)
    .maybeSingle()

  return data?.tab_data?.content || ""
}

async function fetchRepliesWithUsers(db: any, serviceDb: any, stickId: string, orgId: string) {
  const { data: replies, error } = await db
    .from("social_stick_replies")
    .select("*")
    .eq("social_stick_id", stickId)
    .eq("org_id", orgId)
    .order("created_at", { ascending: true })

  if (error) throw error

  const userIds = [...new Set(replies?.map((r: any) => r.user_id) || [])] as string[]
  const usersMap = await fetchUserMap(serviceDb, userIds)

  return replies?.map((reply: any) => ({
    ...reply,
    users: usersMap[reply.user_id] || null,
  })) || []
}

// ============================================================================
// Access Control
// ============================================================================

async function checkViewAccess(
  db: any,
  padId: string,
  padOwnerId: string | undefined,
  userId: string,
  orgId: string
): Promise<boolean> {
  if (padOwnerId === userId) return true

  const { data: membership } = await fetchMembership(db, padId, userId, orgId)
  return !!membership
}

function canEditStick(
  stick: StickWithPad,
  userId: string,
  padOwnerId: string | undefined,
  membershipRole: string | null
): boolean {
  return (
    stick.user_id === userId ||
    padOwnerId === userId ||
    membershipRole === "admin" ||
    membershipRole === "edit"
  )
}

function canDeleteStick(
  stick: StickWithPad,
  userId: string,
  padOwnerId: string | undefined
): boolean {
  return stick.user_id === userId || padOwnerId === userId
}

// ============================================================================
// Route Handlers
// ============================================================================

export async function GET(request: Request, { params }: { params: Promise<{ stickId: string }> }) {
  try {
    const db = await createDatabaseClient()
    const { stickId } = await params

    // Auth check
    const authResult = await getAuthenticatedContext()
    if (!authResult.success) {
      return authResult.response
    }
    const { user, orgContext } = authResult.context

    // Fetch stick
    const { data: stick, error: stickError } = await fetchStick(db, stickId, orgContext.orgId)
    if (stickError) throw stickError
    if (!stick) {
      return Errors.stickNotFound()
    }

    // Extract pad info
    const { padId, padOwnerId } = extractPadInfo(stick as StickWithPad)
    if (!padId) {
      return Errors.invalidStick()
    }

    // Check access
    const hasAccess = await checkViewAccess(db, padId, padOwnerId, user.id, orgContext.orgId)
    if (!hasAccess) {
      return Errors.accessDenied()
    }

    // Fetch details and replies
    const serviceDb = await createServiceDatabaseClient()
    const [details, repliesWithUsers] = await Promise.all([
      fetchDetailsTab(db, stickId, orgContext.orgId),
      fetchRepliesWithUsers(db, serviceDb, stickId, orgContext.orgId),
    ])

    return NextResponse.json({
      stick: { ...stick, details, replies: repliesWithUsers },
    })
  } catch (error) {
    console.error(`${LOG_PREFIX} Error fetching:`, error)
    return Errors.fetchFailed()
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ stickId: string }> }) {
  try {
    const db = await createDatabaseClient()
    const { stickId } = await params

    // Auth check
    const authResult = await getAuthenticatedContext()
    if (!authResult.success) {
      return authResult.response
    }
    const { user, orgContext } = authResult.context

    const updates = await request.json()

    // Fetch stick for access check
    const { data: stick } = await fetchStickForAccess(db, stickId, orgContext.orgId)
    if (!stick) {
      return Errors.stickNotFound()
    }

    // Check edit permission
    const { padOwnerId } = extractPadInfo(stick as StickWithPad)
    const { data: membership } = await fetchMembership(db, stick.social_pad_id, user.id, orgContext.orgId)

    if (!canEditStick(stick as StickWithPad, user.id, padOwnerId, membership?.role || null)) {
      return Errors.permissionDenied()
    }

    // Update stick
    const { data: updatedStick, error } = await db
      .from("social_sticks")
      .update(updates)
      .eq("id", stickId)
      .eq("org_id", orgContext.orgId)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ stick: updatedStick })
  } catch (error) {
    console.error(`${LOG_PREFIX} Error updating:`, error)
    return Errors.updateFailed()
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ stickId: string }> }) {
  try {
    const db = await createDatabaseClient()
    const { stickId } = await params

    // Auth check
    const authResult = await getAuthenticatedContext()
    if (!authResult.success) {
      return authResult.response
    }
    const { user, orgContext } = authResult.context

    // Fetch stick for access check
    const { data: stick } = await fetchStickForAccess(db, stickId, orgContext.orgId)
    if (!stick) {
      return Errors.stickNotFound()
    }

    // Check delete permission
    const { padOwnerId } = extractPadInfo(stick as StickWithPad)
    if (!canDeleteStick(stick as StickWithPad, user.id, padOwnerId)) {
      return Errors.permissionDenied()
    }

    if (await isUnderLegalHold(user.id, orgContext.orgId)) {
      return NextResponse.json({ error: "Content cannot be deleted: active legal hold" }, { status: 403 })
    }

    // Delete stick
    const { error } = await db
      .from("social_sticks")
      .delete()
      .eq("id", stickId)
      .eq("org_id", orgContext.orgId)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(`${LOG_PREFIX} Error deleting:`, error)
    return Errors.deleteFailed()
  }
}

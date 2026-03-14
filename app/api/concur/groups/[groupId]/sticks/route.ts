import { createDatabaseClient, createServiceDatabaseClient } from "@/lib/database/database-adapter"
import { NextResponse } from "next/server"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from "@/lib/auth/cached-auth"
import { publishToOrg } from "@/lib/ws/publish-event"

// ============================================================================
// Types
// ============================================================================

interface User {
  id: string
  full_name: string | null
  email: string
  avatar_url: string | null
}

// ============================================================================
// Constants & Errors
// ============================================================================

const LOG_PREFIX = "[ConcurSticks]"
const DEFAULT_STICK_COLOR = "#fef08a"

const Errors = {
  rateLimit: () => createRateLimitResponse(),
  unauthorized: () => createUnauthorizedResponse(),
  noOrgContext: () => NextResponse.json({ error: "No organization context" }, { status: 403 }),
  forbidden: () => NextResponse.json({ error: "Access denied" }, { status: 403 }),
  contentRequired: () => NextResponse.json({ error: "Content is required" }, { status: 400 }),
  fetchFailed: () => NextResponse.json({ error: "Failed to fetch sticks" }, { status: 500 }),
  createFailed: () => NextResponse.json({ error: "Failed to create stick" }, { status: 500 }),
}

// ============================================================================
// Auth & Access Helpers
// ============================================================================

async function getAuthenticatedOrgContext() {
  const { user, error: authError } = await getCachedAuthUser()
  if (authError === "rate_limited") return { error: "RATE_LIMITED" as const }
  if (!user) return { error: "UNAUTHORIZED" as const }

  const orgContext = await getOrgContext()
  if (!orgContext) return { error: "NO_ORG" as const }

  return { user, orgContext }
}

async function checkGroupMembership(db: any, groupId: string, userId: string, orgId: string) {
  const { data } = await db
    .from("concur_group_members")
    .select("role")
    .eq("group_id", groupId)
    .eq("user_id", userId)
    .eq("org_id", orgId)
    .maybeSingle()
  return data
}

// ============================================================================
// GET - List sticks in a group (paginated)
// ============================================================================

export async function GET(request: Request, { params }: { params: Promise<{ groupId: string }> }) {
  try {
    const { groupId } = await params
    const { searchParams } = new URL(request.url)
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "20", 10), 1), 100)
    const offset = Math.max(parseInt(searchParams.get("offset") || "0", 10), 0)

    const authResult = await getAuthenticatedOrgContext()
    if ("error" in authResult) {
      if (authResult.error === "RATE_LIMITED") return Errors.rateLimit()
      if (authResult.error === "UNAUTHORIZED") return Errors.unauthorized()
      return Errors.noOrgContext()
    }

    const { user, orgContext } = authResult
    const db = await createDatabaseClient()
    const serviceDb = await createServiceDatabaseClient()

    // Check membership
    const membership = await checkGroupMembership(db, groupId, user.id, orgContext.orgId)
    if (!membership) return Errors.forbidden()

    // Fetch sticks with pagination
    const { data: sticks, error } = await db
      .from("concur_sticks")
      .select("*")
      .eq("group_id", groupId)
      .order("is_pinned", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(limit + 1)
      .range(offset, offset + limit)

    if (error) {
      console.error(`${LOG_PREFIX} Error fetching sticks:`, error)
      return Errors.fetchFailed()
    }

    const hasMore = (sticks || []).length > limit
    const pageSticks = hasMore ? (sticks || []).slice(0, limit) : (sticks || [])

    // Enrich with user data and reply counts
    const userIds = [...new Set(pageSticks.map((s: any) => s.user_id).filter(Boolean))]
    const stickIds = pageSticks.map((s: any) => s.id)

    const [usersResult, repliesResult] = await Promise.all([
      userIds.length > 0
        ? serviceDb.from("users").select("id, full_name, email, avatar_url").in("id", userIds)
        : { data: [] },
      stickIds.length > 0
        ? db.from("concur_stick_replies").select("stick_id").in("stick_id", stickIds)
        : { data: [] },
    ])

    const userMap = new Map((usersResult.data || []).map((u: User) => [u.id, u]))

    const replyCountMap = new Map<string, number>()
    for (const reply of (repliesResult.data || [])) {
      replyCountMap.set(reply.stick_id, (replyCountMap.get(reply.stick_id) || 0) + 1)
    }

    const enrichedSticks = pageSticks.map((stick: any) => ({
      ...stick,
      user: stick.user_id ? userMap.get(stick.user_id) || null : null,
      reply_count: replyCountMap.get(stick.id) || 0,
    }))

    return NextResponse.json({ sticks: enrichedSticks, hasMore })
  } catch (error) {
    console.error(`${LOG_PREFIX} GET error:`, error)
    return Errors.fetchFailed()
  }
}

// ============================================================================
// POST - Create a stick in the group (members only)
// ============================================================================

export async function POST(request: Request, { params }: { params: Promise<{ groupId: string }> }) {
  try {
    const { groupId } = await params
    const authResult = await getAuthenticatedOrgContext()
    if ("error" in authResult) {
      if (authResult.error === "RATE_LIMITED") return Errors.rateLimit()
      if (authResult.error === "UNAUTHORIZED") return Errors.unauthorized()
      return Errors.noOrgContext()
    }

    const { user, orgContext } = authResult
    const db = await createDatabaseClient()

    // Check membership
    const membership = await checkGroupMembership(db, groupId, user.id, orgContext.orgId)
    if (!membership) return Errors.forbidden()

    const { topic, content, color } = await request.json()
    if (!content?.trim()) return Errors.contentRequired()

    // Create stick
    const { data: stick, error } = await db
      .from("concur_sticks")
      .insert({
        group_id: groupId,
        user_id: user.id,
        org_id: orgContext.orgId,
        topic: topic?.trim() || null,
        content: content.trim(),
        color: color || DEFAULT_STICK_COLOR,
      })
      .select()
      .single()

    if (error) {
      console.error(`${LOG_PREFIX} Error creating stick:`, error)
      return Errors.createFailed()
    }

    // Broadcast
    publishToOrg(orgContext.orgId, {
      type: "concur.stick_created",
      payload: { groupId, stickId: stick.id, userId: user.id },
      timestamp: Date.now(),
    })

    return NextResponse.json({ stick })
  } catch (error) {
    console.error(`${LOG_PREFIX} POST error:`, error)
    return Errors.createFailed()
  }
}

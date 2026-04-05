import { createDatabaseClient, createServiceDatabaseClient, type DatabaseClient } from "@/lib/database/database-adapter"
import { NextResponse } from "next/server"
import { getOrgContext, type OrgContext } from "@/lib/auth/get-org-context"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

// Types
interface MemberUser {
  id: string
  full_name: string | null
  username: string | null
  email: string | null
  avatar_url: string | null
  hourly_rate_cents: number | null
}

interface InferencePadMember {
  id: string
  social_pad_id: string
  user_id: string
  role: string
  accepted: boolean
  invited_by: string | null
  org_id: string
  created_at: string
  users?: MemberUser | null
}

interface AuthenticatedContext {
  user: { id: string }
  orgContext: OrgContext
  db: DatabaseClient
  serviceClient: DatabaseClient
}

interface PadContext extends AuthenticatedContext {
  padId: string
  ownerId: string
  padName?: string
  canManage: boolean
}

// Constants
const VALID_ROLES = ["admin", "editor", "viewer"] as const
const RATE_LIMIT_HEADERS = { "Retry-After": "30" }
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
const USER_SELECT_FIELDS = "id, full_name, username, email, avatar_url, hourly_rate_cents"

// Error responses
const Errors = {
  rateLimit: (extras: Record<string, unknown> = {}) =>
    NextResponse.json(
      { error: "Rate limit exceeded. Please try again in a moment.", ...extras },
      { status: 429, headers: RATE_LIMIT_HEADERS }
    ),
  unauthorized: () => NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
  orgRequired: () => NextResponse.json({ error: "Organization context required" }, { status: 401 }),
  notFound: (entity = "Resource") => NextResponse.json({ error: `${entity} not found` }, { status: 404 }),
  forbidden: (message = "Permission denied") => NextResponse.json({ error: message }, { status: 403 }),
  badRequest: (message: string) => NextResponse.json({ error: message }, { status: 400 }),
  serverError: (message = "Internal server error") => NextResponse.json({ error: message }, { status: 500 }),
} as const

// Helper functions
function isRateLimitError(error: { message?: string; code?: string }): boolean {
  return error.message?.includes("Too Many") || error.code === "429"
}

function normalizeRole(role: string): string | null {
  if (role === "member") return "viewer"
  return VALID_ROLES.includes(role as typeof VALID_ROLES[number]) ? role : null
}

async function getAuthenticatedContext(): Promise<AuthenticatedContext | NextResponse> {
  const authResult = await getCachedAuthUser()

  if (authResult.rateLimited) {
    return Errors.rateLimit({ members: [], isOwner: false })
  }

  if (!authResult.user) {
    return Errors.unauthorized()
  }

  let orgContext: OrgContext | null = null
  try {
    orgContext = await getOrgContext()
  } catch (orgError) {
    if (orgError instanceof Error && orgError.message === "RATE_LIMITED") {
      return Errors.rateLimit({ members: [], isOwner: false })
    }
    throw orgError
  }

  if (!orgContext) {
    return Errors.orgRequired()
  }

  const db = await createDatabaseClient()
  const serviceClient = await createServiceDatabaseClient()

  return { user: authResult.user, orgContext, db, serviceClient }
}

async function getPadContext(
  context: AuthenticatedContext,
  padId: string
): Promise<PadContext | NextResponse> {
  const { db, orgContext, user } = context

  const { data: pad, error } = await db
    .from("social_pads")
    .select("owner_id, name")
    .eq("id", padId)
    .eq("org_id", orgContext.orgId)
    .maybeSingle()

  if (error) {
    if (isRateLimitError(error)) {
      return Errors.rateLimit({ members: [], isOwner: false })
    }
    console.error("[v0] Error fetching pad:", error)
    return Errors.serverError("Failed to fetch pad")
  }

  if (!pad) {
    return Errors.notFound("Pad")
  }

  const membership = await checkMembership(db, padId, user.id, orgContext.orgId)
  const canManage = pad.owner_id === user.id || membership?.role === "admin"

  return {
    ...context,
    padId,
    ownerId: pad.owner_id,
    padName: pad.name,
    canManage,
  }
}

async function checkMembership(
  db: DatabaseClient,
  padId: string,
  userId: string,
  orgId: string
): Promise<{ role: string } | null> {
  const { data, error } = await db
    .from("social_pad_members")
    .select("role")
    .eq("social_pad_id", padId)
    .eq("user_id", userId)
    .eq("accepted", true)
    .eq("org_id", orgId)
    .maybeSingle()

  if (error && !isRateLimitError(error)) {
    console.error("[v0] Error checking membership:", error)
  }

  return data
}

async function fetchMemberUsers(
  serviceClient: DatabaseClient,
  members: InferencePadMember[]
): Promise<InferencePadMember[]> {
  if (!members.length) return members

  const userIds = [...new Set(members.map((m) => m.user_id))]
  const { data: users, error } = await serviceClient
    .from("users")
    .select(USER_SELECT_FIELDS)
    .in("id", userIds)

  if (error) {
    if (isRateLimitError(error)) {
      return members.map((m) => ({ ...m, users: null }))
    }
    console.error("[v0] Error fetching users:", error)
    throw new Error("Failed to fetch user details")
  }

  return members.map((member) => ({
    ...member,
    users: (users as MemberUser[])?.find((u) => u.id === member.user_id) || null,
  }))
}

async function getUserData(serviceClient: DatabaseClient, userId: string): Promise<MemberUser | null> {
  const { data } = await serviceClient
    .from("users")
    .select(USER_SELECT_FIELDS)
    .eq("id", userId)
    .maybeSingle()
  return data as MemberUser | null
}

async function sendInviteEmail(
  email: string,
  padName: string,
  role: string,
  padId: string,
  isNewUser: boolean
): Promise<void> {
  const padUrl = `${SITE_URL}/social/pads/${padId}`
  const authUrl = `${SITE_URL}/auth/login?email=${encodeURIComponent(email)}&redirectTo=${encodeURIComponent(padUrl)}`

  const subject = isNewUser
    ? `You've been invited to join "${padName}" on Stick My Note`
    : `You've been added to "${padName}" on Stick My Note`

  const actionText = isNewUser ? "invited to join" : "added to"
  const buttonText = isNewUser ? `Sign In & Join ${padName}` : `View ${padName}`

  try {
    await fetch(`${SITE_URL}/api/send-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: email,
        subject,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>You've been ${actionText} a Social Pad!</h2>
            <p>You've been ${actionText} "<strong>${padName}</strong>" with the role of <strong>${role}</strong>.</p>
            <a href="${authUrl}" style="background-color: #9333ea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block; margin: 16px 0;">
              ${buttonText}
            </a>
          </div>
        `,
        text: `You've been ${actionText} "${padName}" with role ${role}. Access it at: ${authUrl}`,
      }),
    })
  } catch (e) {
    console.error("[v0] Email send error:", e)
  }
}

async function addExistingUserAsMember(
  context: PadContext,
  invitedUserId: string,
  email: string,
  role: string
): Promise<NextResponse> {
  const { serviceClient, orgContext, user, padId, padName } = context

  // Check if already a member
  const { data: existingMember } = await serviceClient
    .from("social_pad_members")
    .select("id")
    .eq("social_pad_id", padId)
    .eq("user_id", invitedUserId)
    .eq("org_id", orgContext.orgId)
    .maybeSingle()

  if (existingMember) {
    return Errors.badRequest("User is already a member of this pad")
  }

  const { data: newMember, error: insertError } = await serviceClient
    .from("social_pad_members")
    .insert({
      social_pad_id: padId,
      user_id: invitedUserId,
      role,
      invited_by: user.id,
      accepted: true,
      org_id: orgContext.orgId,
    })
    .select("*")
    .maybeSingle()

  if (insertError) {
    console.error("[v0] Error adding member:", insertError)
    return Errors.serverError(`Failed to add member: ${insertError.message}`)
  }

  if (!newMember) {
    return Errors.serverError("Failed to add member - no data returned")
  }

  const userData = await getUserData(serviceClient, invitedUserId)
  await sendInviteEmail(email, padName || "Social Pad", role, padId, false)

  return NextResponse.json({
    member: { ...newMember, users: userData },
    userExists: true,
  })
}

async function createPendingInvite(
  context: PadContext,
  email: string,
  role: string
): Promise<NextResponse> {
  const { db, orgContext, user, padId, padName } = context

  // Check for existing invite
  const { data: existingInvite } = await db
    .from("social_pad_pending_invites")
    .select("id")
    .eq("social_pad_id", padId)
    .eq("email", email)
    .eq("org_id", orgContext.orgId)
    .maybeSingle()

  if (existingInvite) {
    return Errors.badRequest("An invitation has already been sent to this email")
  }

  const { error: inviteError } = await db.from("social_pad_pending_invites").insert({
    social_pad_id: padId,
    email,
    role,
    invited_by: user.id,
    org_id: orgContext.orgId,
  })

  if (inviteError) {
    console.error("[v0] Error creating pending invite:", inviteError)
    throw inviteError
  }

  await sendInviteEmail(email, padName || "Social Pad", role, padId, true)

  return NextResponse.json({
    success: true,
    userExists: false,
    message: "Invitation email sent successfully.",
  })
}

// Route handlers
export async function GET(request: Request, { params }: { params: Promise<{ padId: string }> }) {
  try {
    const { padId } = await params
    const contextResult = await getAuthenticatedContext()
    if (contextResult instanceof NextResponse) return contextResult

    const padContext = await getPadContext(contextResult, padId)
    if (padContext instanceof NextResponse) return padContext

    const { db, serviceClient, orgContext, user, padId: contextPadId, ownerId } = padContext
    const membership = await checkMembership(db, contextPadId, user.id, orgContext.orgId)

    if (!membership && ownerId !== user.id) {
      return Errors.forbidden("Access denied")
    }

    // Check for search query parameter
    const { searchParams } = new URL(request.url)
    const searchQuery = searchParams.get("search")?.trim()
    const limit = Number.parseInt(searchParams.get("limit") || "0", 10)

    // If search query provided, search users first then filter members
    if (searchQuery && searchQuery.length >= 2) {
      // Search users by name or email
      const { data: matchingUsers, error: userSearchError } = await serviceClient
        .from("users")
        .select("id, full_name, email, avatar_url")
        .or(`full_name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`)
        .limit(limit > 0 ? limit : 20)

      if (userSearchError) {
        console.error("[v0] Error searching users:", userSearchError)
        return Errors.serverError("Failed to search users")
      }

      if (!matchingUsers?.length) {
        return NextResponse.json({
          members: [],
          isOwner: ownerId === user.id,
        })
      }

      // Find which of these users are members of this pad
      const userIds = matchingUsers.map((u) => u.id)
      const { data: members, error } = await db
        .from("social_pad_members")
        .select("*")
        .eq("social_pad_id", contextPadId)
        .eq("org_id", orgContext.orgId)
        .in("user_id", userIds)

      if (error) {
        if (isRateLimitError(error)) {
          return Errors.rateLimit({ members: [], isOwner: ownerId === user.id })
        }
        console.error("[v0] Error fetching members:", error)
        return Errors.serverError("Failed to fetch members")
      }

      // Attach user data to members
      const membersWithUsers = (members || []).map((member) => ({
        ...member,
        users: matchingUsers.find((u) => u.id === member.user_id) || null,
      }))

      return NextResponse.json({
        members: membersWithUsers,
        isOwner: ownerId === user.id,
      })
    }

    // No search - return all members (with optional limit)
    let query = db
      .from("social_pad_members")
      .select("*")
      .eq("social_pad_id", contextPadId)
      .eq("org_id", orgContext.orgId)
      .order("created_at", { ascending: true })

    if (limit > 0) {
      query = query.limit(limit)
    }

    const { data: members, error } = await query

    if (error) {
      if (isRateLimitError(error)) {
        return Errors.rateLimit({ members: [], isOwner: ownerId === user.id })
      }
      console.error("[v0] Error fetching members:", error)
      return Errors.serverError("Failed to fetch members")
    }

    const membersWithUsers = members?.length
      ? await fetchMemberUsers(serviceClient, members)
      : []

    return NextResponse.json({
      members: membersWithUsers,
      isOwner: ownerId === user.id,
    })
  } catch (error) {
    console.error("[v0] Error in GET /api/inference-pads/[padId]/members:", error)
    const errorMessage = error instanceof Error ? error.message : "Failed to fetch members"
    if (errorMessage === "RATE_LIMITED" || errorMessage.includes("Too Many")) {
      return Errors.rateLimit({ members: [], isOwner: false })
    }
    return Errors.serverError(errorMessage)
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ padId: string }> }) {
  try {
    const { padId } = await params
    const contextResult = await getAuthenticatedContext()
    if (contextResult instanceof NextResponse) return contextResult

    const padContext = await getPadContext(contextResult, padId)
    if (padContext instanceof NextResponse) return padContext

    if (!padContext.canManage) {
      return Errors.forbidden()
    }

    let body: { email?: string; role?: string }
    try {
      body = await request.json()
    } catch {
      return Errors.badRequest("Invalid JSON body")
    }

    const { email, role: requestedRole } = body

    if (!email || !requestedRole) {
      return Errors.badRequest("Email and role are required")
    }

    const role = normalizeRole(requestedRole)
    if (!role) {
      return Errors.badRequest(`Invalid role. Must be one of: ${VALID_ROLES.join(", ")}`)
    }

    // Check if user exists
    const { data: invitedUser, error: userLookupError } = await padContext.serviceClient
      .from("users")
      .select("id, email, full_name")
      .eq("email", email)
      .maybeSingle()

    if (userLookupError) {
      console.error("[v0] Error looking up user:", userLookupError)
      return Errors.serverError("Failed to look up user")
    }

    return invitedUser
      ? addExistingUserAsMember(padContext, invitedUser.id, email, role)
      : createPendingInvite(padContext, email, role)
  } catch (error) {
    console.error("[v0] Error in POST /api/inference-pads/[padId]/members:", error)
    return Errors.serverError(error instanceof Error ? error.message : "Failed to add member")
  }
}

async function updateMemberRole(
  db: DatabaseClient,
  memberId: string,
  role: string,
  padId: string,
  orgId: string
): Promise<void> {
  const normalizedRole = normalizeRole(role)
  if (!normalizedRole) {
    throw new Error(`Invalid role. Must be one of: ${VALID_ROLES.join(", ")}`)
  }

  const { error } = await db
    .from("social_pad_members")
    .update({ role: normalizedRole })
    .eq("id", memberId)
    .eq("social_pad_id", padId)
    .eq("org_id", orgId)

  if (error) throw error
}

async function updateMemberHourlyRate(
  db: DatabaseClient,
  memberId: string,
  hourlyRateCents: number,
  orgId: string
): Promise<void> {
  const { data: memberData } = await db
    .from("social_pad_members")
    .select("user_id")
    .eq("id", memberId)
    .eq("org_id", orgId)
    .maybeSingle()

  if (!memberData) return

  const { error } = await db
    .from("users")
    .update({ hourly_rate_cents: hourlyRateCents })
    .eq("id", memberData.user_id)

  if (error) throw error
}

async function getUpdatedMemberWithUser(
  db: DatabaseClient,
  serviceClient: DatabaseClient,
  memberId: string,
  padId: string,
  orgId: string
): Promise<InferencePadMember | null> {
  const { data: member, error } = await db
    .from("social_pad_members")
    .select("*")
    .eq("id", memberId)
    .eq("social_pad_id", padId)
    .eq("org_id", orgId)
    .maybeSingle()

  if (error) throw error
  if (!member) return null

  const userData = await getUserData(serviceClient, member.user_id)
  return { ...member, users: userData }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ padId: string }> }) {
  try {
    const { padId } = await params
    const contextResult = await getAuthenticatedContext()
    if (contextResult instanceof NextResponse) return contextResult

    const padContext = await getPadContext(contextResult, padId)
    if (padContext instanceof NextResponse) return padContext

    if (!padContext.canManage) {
      return Errors.forbidden()
    }

    const { db, serviceClient, orgContext, padId: contextPadId } = padContext

    let body: { memberId?: string; role?: string; hourlyRateCents?: number }
    try {
      body = await request.json()
    } catch {
      return Errors.badRequest("Invalid JSON body")
    }

    const { memberId, role, hourlyRateCents } = body

    if (!memberId) {
      return Errors.badRequest("Member ID is required")
    }

    if (!role && hourlyRateCents === undefined) {
      return Errors.badRequest("At least one update field (role or hourlyRateCents) is required")
    }

    if (role) {
      await updateMemberRole(db, memberId, role, contextPadId, orgContext.orgId)
    }

    if (hourlyRateCents !== undefined) {
      await updateMemberHourlyRate(db, memberId, hourlyRateCents, orgContext.orgId)
    }

    const updatedMember = await getUpdatedMemberWithUser(db, serviceClient, memberId, contextPadId, orgContext.orgId)

    return NextResponse.json({ member: updatedMember })
  } catch (error) {
    console.error("Error updating member:", error)
    const message = error instanceof Error ? error.message : "Failed to update member"
    
    // Return validation errors as 400, others as 500
    if (message.includes("Invalid role")) {
      return Errors.badRequest(message)
    }
    return Errors.serverError(message)
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ padId: string }> }) {
  try {
    const { padId } = await params
    const contextResult = await getAuthenticatedContext()
    if (contextResult instanceof NextResponse) return contextResult

    const padContext = await getPadContext(contextResult, padId)
    if (padContext instanceof NextResponse) return padContext

    if (!padContext.canManage) {
      return Errors.forbidden()
    }

    const { searchParams } = new URL(request.url)
    const memberId = searchParams.get("memberId")

    if (!memberId) {
      return Errors.badRequest("Member ID is required")
    }

    const { error } = await padContext.db
      .from("social_pad_members")
      .delete()
      .eq("id", memberId)
      .eq("social_pad_id", padContext.padId)
      .eq("org_id", padContext.orgContext.orgId)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error removing member:", error)
    return Errors.serverError("Failed to remove member")
  }
}

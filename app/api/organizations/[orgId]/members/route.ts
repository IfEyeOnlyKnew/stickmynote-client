import { NextResponse } from "next/server"
import { createDatabaseClient } from "@/lib/database/database-adapter"
import { getOrgContext, hasMinRole } from "@/lib/auth/get-org-context"
import { sendOrganizationInviteEmail } from "@/lib/email/resend"

// Types
interface OrgContext {
  orgId: string
  userId: string
  role: string
}

// Helper: Safely get org context with rate limiting
async function safeGetOrgContext(orgId: string) {
  try {
    const context = await getOrgContext(orgId)
    return { context, rateLimited: false }
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "RATE_LIMITED") {
      return { context: null, rateLimited: true }
    }
    throw error
  }
}

// Helper: Handle rate limit response
function handleRateLimitedResponse() {
  return NextResponse.json(
    { error: "Rate limit exceeded. Please try again in a moment." },
    { status: 429, headers: { "Retry-After": "30" } },
  )
}

// Helper: Build users map from user IDs
async function buildUsersMap(
  serviceClient: Awaited<ReturnType<typeof createDatabaseClient>>,
  userIds: string[],
) {
  if (userIds.length === 0) return {}

  const { data: users, error: usersError } = await serviceClient
    .from("users")
    .select("id, email, full_name, avatar_url")
    .in("id", userIds)

  if (usersError) {
    console.error("[v0] Error fetching users:", usersError)
    return {}
  }

  return (users || []).reduce(
    (acc, user) => {
      acc[user.id] = user
      return acc
    },
    {} as Record<string, { id: string; email: string; full_name: string | null; avatar_url: string | null }>,
  )
}

// Helper: Add existing user as member
async function addExistingUserAsMember(
  serviceClient: Awaited<ReturnType<typeof createDatabaseClient>>,
  orgId: string,
  existingUser: { id: string },
  role: string,
  context: OrgContext,
  normalizedEmail: string,
  organizationName: string,
  inviterName: string,
) {
  const { data: existingMember } = await serviceClient
    .from("organization_members")
    .select("id")
    .eq("org_id", orgId)
    .eq("user_id", existingUser.id)
    .maybeSingle()

  if (existingMember) {
    return NextResponse.json({ error: "User is already a member" }, { status: 409 })
  }

  const { data: member, error: memberError } = await serviceClient
    .from("organization_members")
    .insert({
      org_id: orgId,
      user_id: existingUser.id,
      role,
      invited_by: context.userId,
      joined_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (memberError) {
    console.error("[v0] Error adding member:", memberError)
    return NextResponse.json({ error: "Failed to add member" }, { status: 500 })
  }

  await sendOrganizationInviteEmail({
    to: normalizedEmail,
    organizationName,
    inviterName,
    role,
    inviteToken: "direct-add",
  })

  return NextResponse.json({ member, status: "added" }, { status: 201 })
}

// Helper: Create new invite for non-existing user
async function createNewUserInvite(
  serviceClient: Awaited<ReturnType<typeof createDatabaseClient>>,
  orgId: string,
  role: string,
  context: OrgContext,
  normalizedEmail: string,
  organizationName: string,
  inviterName: string,
) {
  const { data: existingInvite } = await serviceClient
    .from("organization_invites")
    .select("id, status")
    .eq("org_id", orgId)
    .eq("email", normalizedEmail)
    .eq("status", "pending")
    .maybeSingle()

  if (existingInvite) {
    return NextResponse.json({ error: "An invitation has already been sent to this email" }, { status: 409 })
  }

  const inviteToken = crypto.randomUUID()

  const { data: invite, error: inviteError } = await serviceClient
    .from("organization_invites")
    .insert({
      org_id: orgId,
      email: normalizedEmail,
      role,
      invited_by: context.userId,
      status: "pending",
      token: inviteToken,
    })
    .select()
    .single()

  if (inviteError) {
    console.error("[v0] Error creating invite:", inviteError)
    return NextResponse.json({ error: "Failed to create invitation" }, { status: 500 })
  }

  const emailResult = await sendOrganizationInviteEmail({
    to: normalizedEmail,
    organizationName,
    inviterName,
    role,
    inviteToken,
  })

  if (!emailResult.success) {
    console.warn("[v0] Failed to send invite email:", emailResult.error)
  }

  return NextResponse.json(
    { invite, status: "invited", emailSent: emailResult.success },
    { status: 201 },
  )
}

// GET /api/organizations/[orgId]/members - Get all members
export async function GET(req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  try {
    const { orgId } = await params

    const { context, rateLimited } = await safeGetOrgContext(orgId)
    if (rateLimited) return handleRateLimitedResponse()
    if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const serviceClient = await createDatabaseClient()

    const { data: members, error } = await serviceClient
      .from("organization_members")
      .select(`id, org_id, user_id, role, invited_by, invited_at, joined_at`)
      .eq("org_id", orgId)
      .order("joined_at", { ascending: true })

    if (error) {
      console.error("[v0] Error fetching members:", error)
      return NextResponse.json({ error: "Failed to fetch members" }, { status: 500 })
    }

    const userIds = members?.map((m) => m.user_id).filter(Boolean) || []
    const usersMap = await buildUsersMap(serviceClient, userIds)

    const membersWithUsers = members?.map((member) => ({
      ...member,
      users: member.user_id ? usersMap[member.user_id] || null : null,
    })) || []

    return NextResponse.json({ members: membersWithUsers })
  } catch (err) {
    console.error("[v0] Unexpected error in GET members:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST /api/organizations/[orgId]/members - Invite a member
export async function POST(req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  try {
    const { orgId } = await params

    const { context, rateLimited } = await safeGetOrgContext(orgId)
    if (rateLimited) return handleRateLimitedResponse()
    if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!hasMinRole(context.role, "admin")) return NextResponse.json({ error: "Permission denied" }, { status: 403 })

    const body = await req.json()
    const { email, role = "member" } = body

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 })
    }
    if (!["admin", "member", "viewer"].includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 })
    }
    if (context.role === "admin" && role === "admin") {
      return NextResponse.json({ error: "Admins cannot invite other admins" }, { status: 403 })
    }

    const serviceClient = await createDatabaseClient()
    const normalizedEmail = email.toLowerCase().trim()

    const [{ data: organization }, { data: inviter }] = await Promise.all([
      serviceClient.from("organizations").select("name").eq("id", orgId).single(),
      serviceClient.from("users").select("full_name, email").eq("id", context.userId).single(),
    ])

    const organizationName = organization?.name || "Organization"
    const inviterName = inviter?.full_name || inviter?.email || "A team member"

    const { data: existingUser, error: userError } = await serviceClient
      .from("users")
      .select("id, email")
      .eq("email", normalizedEmail)
      .maybeSingle()

    if (userError) {
      console.error("[v0] Error checking user:", userError)
      return NextResponse.json({ error: "Failed to check user" }, { status: 500 })
    }

    if (existingUser) {
      return addExistingUserAsMember(
        serviceClient, orgId, existingUser, role, context,
        normalizedEmail, organizationName, inviterName,
      )
    }

    return createNewUserInvite(
      serviceClient, orgId, role, context,
      normalizedEmail, organizationName, inviterName,
    )
  } catch (err) {
    console.error("[v0] Unexpected error in POST members:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE /api/organizations/[orgId]/members - Remove a member
export async function DELETE(req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  try {
    const { orgId } = await params

    const { context, rateLimited } = await safeGetOrgContext(orgId)
    if (rateLimited) return handleRateLimitedResponse()
    if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const userId = searchParams.get("userId")

    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 })
    }

    const serviceClient = await createDatabaseClient()

    const { data: targetMember, error: targetError } = await serviceClient
      .from("organization_members")
      .select("role")
      .eq("org_id", orgId)
      .eq("user_id", userId)
      .single()

    if (targetError || !targetMember) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 })
    }

    if (targetMember.role === "owner") {
      return NextResponse.json({ error: "Cannot remove organization owner" }, { status: 403 })
    }

    const canRemove =
      context.role === "owner" ||
      (context.role === "admin" && ["member", "viewer"].includes(targetMember.role)) ||
      context.userId === userId

    if (!canRemove) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 })
    }

    const { error: deleteError } = await serviceClient
      .from("organization_members")
      .delete()
      .eq("org_id", orgId)
      .eq("user_id", userId)

    if (deleteError) {
      console.error("[v0] Error removing member:", deleteError)
      return NextResponse.json({ error: "Failed to remove member" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[v0] Unexpected error in DELETE members:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

import { type NextRequest, NextResponse } from "next/server"
import { createDatabaseClient, createServiceDatabaseClient, type DatabaseClient } from "@/lib/database/database-adapter"
import { getOrgContext, type OrgContext } from "@/lib/auth/get-org-context"
import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from "@/lib/auth/cached-auth"

// Types
interface UserData {
  id: string
  email: string | null
  username: string | null
  full_name: string | null
}

interface FormattedMember extends UserData {
  role: string
}

interface AuthenticatedContext {
  user: { id: string }
  orgContext: OrgContext
}

// Helper functions
function extractUser(users: UserData | UserData[] | null): UserData | null {
  if (!users) return null
  return Array.isArray(users) ? users[0] : users
}

async function getAuthenticatedContext(userId: string): Promise<AuthenticatedContext | NextResponse> {
  let orgContext: OrgContext | null = null
  try {
    orgContext = await getOrgContext(userId)
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    if (errorMessage === "RATE_LIMITED") {
      return createRateLimitResponse()
    }
    throw err
  }

  if (!orgContext) {
    return NextResponse.json({ error: "No organization context" }, { status: 403 })
  }

  return { user: { id: userId }, orgContext }
}

async function requireAuth(): Promise<{ user: { id: string } } | NextResponse> {
  const authResult = await getCachedAuthUser()

  if (authResult.rateLimited) {
    return createRateLimitResponse()
  }

  if (!authResult.user) {
    return createUnauthorizedResponse()
  }

  return { user: authResult.user }
}

async function fetchPad(
  db: DatabaseClient,
  padId: string,
  orgId: string,
  includeOwner = false
): Promise<{ pad: any; error: NextResponse | null }> {
  const select = includeOwner
    ? "name, owner_id, org_id, users!paks_pads_owner_id_fkey(id, email, username, full_name)"
    : "owner_id, org_id"

  const { data: pad, error } = await db
    .from("paks_pads")
    .select(select)
    .eq("id", padId)
    .eq("org_id", orgId)
    .maybeSingle()

  if (error || !pad) {
    return { pad: null, error: NextResponse.json({ error: "Pad not found" }, { status: 404 }) }
  }

  return { pad, error: null }
}

function formatMembers(pad: any, members: any[] | null): FormattedMember[] {
  const formattedMembers: FormattedMember[] = []

  // Add owner first
  const ownerUser = extractUser(pad.users)
  if (ownerUser) {
    formattedMembers.push({
      id: ownerUser.id,
      email: ownerUser.email,
      username: ownerUser.username,
      full_name: ownerUser.full_name,
      role: "owner",
    })
  }

  // Add other members
  if (members?.length) {
    for (const member of members) {
      const memberUser = extractUser(member.users)
      if (memberUser && memberUser.id !== pad.owner_id) {
        formattedMembers.push({
          id: memberUser.id,
          email: memberUser.email,
          username: memberUser.username,
          full_name: memberUser.full_name,
          role: member.role,
        })
      }
    }
  }

  return formattedMembers
}

async function checkAdminOrOwner(
  db: DatabaseClient,
  padId: string,
  userId: string,
  ownerId: string,
  orgId: string,
): Promise<boolean> {
  if (ownerId === userId) return true

  const { data: memberCheck } = await db
    .from("paks_pad_members")
    .select("role")
    .eq("pad_id", padId)
    .eq("user_id", userId)
    .eq("org_id", orgId)
    .maybeSingle()

  return memberCheck?.role === "admin"
}

// Route handlers
export async function GET(request: NextRequest, { params }: { params: { padId: string } }) {
  try {
    await createDatabaseClient()
    const dbAdmin = await createServiceDatabaseClient()

    const authResult = await requireAuth()
    if (authResult instanceof NextResponse) return authResult

    const contextResult = await getAuthenticatedContext(authResult.user.id)
    if (contextResult instanceof NextResponse) return contextResult

    const { orgContext } = contextResult
    const { padId } = params

    const { pad, error: padError } = await fetchPad(dbAdmin, padId, orgContext.orgId, true)
    if (padError) return padError

    const { data: members, error: membersError } = await dbAdmin
      .from("paks_pad_members")
      .select("user_id, role, org_id, users!paks_pad_members_user_id_fkey(id, email, username, full_name)")
      .eq("pad_id", padId)
      .eq("org_id", orgContext.orgId)

    if (membersError) {
      return NextResponse.json({ error: "Failed to fetch members" }, { status: 500 })
    }

    return NextResponse.json({
      padName: pad.name,
      members: formatMembers(pad, members),
    })
  } catch (error) {
    console.error("Error in pad members API:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { padId: string } }) {
  try {
    const db = await createDatabaseClient()
    const { padId } = params

    const authResult = await requireAuth()
    if (authResult instanceof NextResponse) return authResult

    const contextResult = await getAuthenticatedContext(authResult.user.id)
    if (contextResult instanceof NextResponse) return contextResult

    const { orgContext } = contextResult

    const userIdToRemove = new URL(request.url).searchParams.get("userId")
    if (!userIdToRemove) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 })
    }

    const { pad, error: padError } = await fetchPad(db, padId, orgContext.orgId)
    if (padError) return padError

    if (pad.owner_id !== authResult.user.id) {
      return NextResponse.json({ error: "Only pad owners can remove members" }, { status: 403 })
    }

    const { error: deleteError } = await db
      .from("paks_pad_members")
      .delete()
      .eq("pad_id", padId)
      .eq("user_id", userIdToRemove)
      .eq("org_id", orgContext.orgId)

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error removing pad member:", error)
    return NextResponse.json({ error: "Failed to remove member" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { padId: string } }) {
  try {
    const db = await createDatabaseClient()
    const { padId } = params

    const authResult = await requireAuth()
    if (authResult instanceof NextResponse) return authResult

    const contextResult = await getAuthenticatedContext(authResult.user.id)
    if (contextResult instanceof NextResponse) return contextResult

    const { orgContext } = contextResult

    const { userId, role } = await request.json()
    if (!userId || !role) {
      return NextResponse.json({ error: "Missing userId or role" }, { status: 400 })
    }

    const { pad, error: padError } = await fetchPad(db, padId, orgContext.orgId)
    if (padError) return padError

    const canUpdate = await checkAdminOrOwner(db, padId, authResult.user.id, pad.owner_id, orgContext.orgId)
    if (!canUpdate) {
      return NextResponse.json({ error: "Only owners and admins can update member roles" }, { status: 403 })
    }

    const { error: updateError } = await db
      .from("paks_pad_members")
      .update({ role })
      .eq("pad_id", padId)
      .eq("user_id", userId)
      .eq("org_id", orgContext.orgId)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error updating pad member role:", error)
    return NextResponse.json({ error: "Failed to update member role" }, { status: 500 })
  }
}

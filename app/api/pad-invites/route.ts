import { type NextRequest, NextResponse } from "next/server"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"
import { getOrgContext } from "@/lib/auth/get-org-context"
import {
  VALID_ROLES,
  mapRoleForDatabase,
  createInviteResults,
  fetchPadAndVerifyAccess,
  processUserIdInvites,
  processEmailInvites,
} from "@/lib/handlers/pad-invites-handler"

export async function POST(request: NextRequest) {
  try {
    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again in a moment." },
        { status: 429, headers: { "Retry-After": "30" } },
      )
    }
    if (!authResult.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const user = authResult.user

    const orgContext = await getOrgContext()
    if (!orgContext) {
      return NextResponse.json({ error: "No organization context" }, { status: 403 })
    }

    const { padId, role, userIds, emails } = await request.json()

    if (!padId || !role) {
      return NextResponse.json({ error: "Missing padId or role" }, { status: 400 })
    }

    if (!VALID_ROLES.has(role.toLowerCase())) {
      return NextResponse.json({ error: "Invalid role. Must be admin, editor, or viewer" }, { status: 400 })
    }

    const dbRole = mapRoleForDatabase(role)

    // Fetch pad and verify permissions
    const padCheck = await fetchPadAndVerifyAccess(padId, orgContext.orgId, user.id)
    if (padCheck.error) {
      return NextResponse.json({ error: padCheck.error }, { status: padCheck.status })
    }

    const results = createInviteResults()
    const inviteContext = {
      padId,
      dbRole,
      orgId: orgContext.orgId,
      inviterId: user.id,
      inviterEmail: user.email || "",
      padName: padCheck.pad.name,
      role,
    }

    if (userIds?.length) {
      await processUserIdInvites(userIds, inviteContext, results)
    }

    if (emails?.length) {
      await processEmailInvites(emails, inviteContext, results)
    }

    results.total = results.success.length + results.failed.length

    return NextResponse.json({ success: true, summary: results })
  } catch (error) {
    console.error("[PadInvites] POST error:", error)
    return NextResponse.json(
      { error: "Failed to process invitations", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}

import { NextResponse } from "next/server"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"
import { checkPadInviteAccess, getPendingInvites, deletePendingInvite } from "@/lib/handlers/inference-pads-pending-invites-handler"

export async function GET(request: Request, { params }: { params: Promise<{ padId: string }> }) {
  try {
    const { padId } = await params
    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) {
      return NextResponse.json({ error: "Rate limited" }, { status: 429, headers: { "Retry-After": "30" } })
    }
    if (!authResult.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const orgContext = await getOrgContext()
    if (!orgContext) {
      return NextResponse.json({ error: "No organization context" }, { status: 403 })
    }

    const { canManage, padExists } = await checkPadInviteAccess(padId, authResult.user.id, orgContext.orgId)
    if (!padExists) {
      return NextResponse.json({ error: "Pad not found" }, { status: 404 })
    }
    if (!canManage) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 })
    }

    const pendingInvites = await getPendingInvites(padId, orgContext.orgId)
    return NextResponse.json({ pendingInvites })
  } catch (error) {
    console.error("[v0] Error in GET /api/inference-pads/[padId]/pending-invites:", error)
    return NextResponse.json({ pendingInvites: [] })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ padId: string }> }) {
  try {
    const { padId } = await params
    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) {
      return NextResponse.json({ error: "Rate limited" }, { status: 429, headers: { "Retry-After": "30" } })
    }
    if (!authResult.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const orgContext = await getOrgContext()
    if (!orgContext) {
      return NextResponse.json({ error: "No organization context" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const inviteId = searchParams.get("inviteId")
    if (!inviteId) {
      return NextResponse.json({ error: "Invite ID is required" }, { status: 400 })
    }

    const { canManage, padExists } = await checkPadInviteAccess(padId, authResult.user.id, orgContext.orgId)
    if (!padExists) {
      return NextResponse.json({ error: "Pad not found" }, { status: 404 })
    }
    if (!canManage) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 })
    }

    await deletePendingInvite(inviteId, padId, orgContext.orgId)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error in DELETE /api/inference-pads/[padId]/pending-invites:", error)
    return NextResponse.json({ error: "Failed to delete pending invite" }, { status: 500 })
  }
}

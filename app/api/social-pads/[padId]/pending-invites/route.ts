import { createDatabaseClient } from "@/lib/database/database-adapter"
import { NextResponse } from "next/server"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

export async function GET(request: Request, { params }: { params: { padId: string } }) {
  try {
    const db = await createDatabaseClient()
    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) {
      return NextResponse.json({ error: "Rate limited" }, { status: 429, headers: { "Retry-After": "30" } })
    }
    if (!authResult.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const user = authResult.user

    const orgContext = await getOrgContext(user.id)
    if (!orgContext) {
      return NextResponse.json({ error: "No organization context" }, { status: 403 })
    }

    const { padId } = params

    const { data: pad } = await db
      .from("social_pads")
      .select("owner_id")
      .eq("id", padId)
      .eq("org_id", orgContext.orgId)
      .single()

    if (!pad) {
      return NextResponse.json({ error: "Pad not found" }, { status: 404 })
    }

    const { data: membership } = await db
      .from("social_pad_members")
      .select("role")
      .eq("social_pad_id", padId)
      .eq("user_id", user.id)
      .eq("accepted", true)
      .eq("org_id", orgContext.orgId)
      .maybeSingle()

    const canView = pad.owner_id === user.id || membership?.role === "admin"

    if (!canView) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 })
    }

    const { data: pendingInvites, error } = await db
      .from("social_pad_pending_invites")
      .select("*")
      .eq("social_pad_id", padId)
      .eq("org_id", orgContext.orgId)
      .order("invited_at", { ascending: false })

    if (error) {
      if (error.code === "42P01" || error.message.includes("does not exist")) {
        console.log("[v0] social_pad_pending_invites table does not exist yet, returning empty array")
        return NextResponse.json({ pendingInvites: [] })
      }
      console.error("[v0] Error fetching pending invites:", error)
      return NextResponse.json({ error: "Failed to fetch pending invites" }, { status: 500 })
    }

    return NextResponse.json({ pendingInvites: pendingInvites || [] })
  } catch (error) {
    console.error("[v0] Error in GET /api/social-pads/[padId]/pending-invites:", error)
    return NextResponse.json({ pendingInvites: [] })
  }
}

export async function DELETE(request: Request, { params }: { params: { padId: string } }) {
  try {
    const db = await createDatabaseClient()
    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) {
      return NextResponse.json({ error: "Rate limited" }, { status: 429, headers: { "Retry-After": "30" } })
    }
    if (!authResult.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const user = authResult.user

    const orgContext = await getOrgContext(user.id)
    if (!orgContext) {
      return NextResponse.json({ error: "No organization context" }, { status: 403 })
    }

    const { padId } = params
    const { searchParams } = new URL(request.url)
    const inviteId = searchParams.get("inviteId")

    if (!inviteId) {
      return NextResponse.json({ error: "Invite ID is required" }, { status: 400 })
    }

    const { data: pad } = await db
      .from("social_pads")
      .select("owner_id")
      .eq("id", padId)
      .eq("org_id", orgContext.orgId)
      .single()

    if (!pad) {
      return NextResponse.json({ error: "Pad not found" }, { status: 404 })
    }

    const { data: membership } = await db
      .from("social_pad_members")
      .select("role")
      .eq("social_pad_id", padId)
      .eq("user_id", user.id)
      .eq("accepted", true)
      .eq("org_id", orgContext.orgId)
      .maybeSingle()

    const canDelete = pad.owner_id === user.id || membership?.role === "admin"

    if (!canDelete) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 })
    }

    const { error } = await db
      .from("social_pad_pending_invites")
      .delete()
      .eq("id", inviteId)
      .eq("social_pad_id", padId)
      .eq("org_id", orgContext.orgId)

    if (error) {
      console.error("Error deleting pending invite:", error)
      return NextResponse.json({ error: "Failed to delete pending invite" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error in DELETE /api/social-pads/[padId]/pending-invites:", error)
    return NextResponse.json({ error: "Failed to delete pending invite" }, { status: 500 })
  }
}

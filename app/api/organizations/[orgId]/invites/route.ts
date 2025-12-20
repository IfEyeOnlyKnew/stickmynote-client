import { NextResponse } from "next/server"
import { createServiceDatabaseClient } from "@/lib/database/database-adapter"
import { getOrgContext, hasMinRole } from "@/lib/auth/get-org-context"

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

// GET /api/organizations/[orgId]/invites - Get pending invites
export async function GET(req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  try {
    const { orgId } = await params

    const { context, rateLimited } = await safeGetOrgContext(orgId)
    if (rateLimited) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again in a moment." },
        { status: 429, headers: { "Retry-After": "30" } },
      )
    }

    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only admins and owners can view invites
    if (!hasMinRole(context.role, "admin")) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 })
    }

    const serviceDb = await createServiceDatabaseClient()

    const { data: invites, error } = await serviceDb
      .from("organization_invites")
      .select("id, org_id, email, role, invited_by, invited_at, expires_at, status")
      .eq("org_id", orgId)
      .eq("status", "pending")
      .order("invited_at", { ascending: false })

    if (error) {
      console.error("[v0] Error fetching invites:", error)
      return NextResponse.json({ error: "Failed to fetch invites" }, { status: 500 })
    }

    return NextResponse.json({ invites: invites || [] })
  } catch (err) {
    console.error("[v0] Unexpected error in GET invites:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE /api/organizations/[orgId]/invites/[inviteId] - Cancel an invite
export async function DELETE(req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  try {
    const { orgId } = await params
    const { searchParams } = new URL(req.url)
    const inviteId = searchParams.get("inviteId")

    if (!inviteId) {
      return NextResponse.json({ error: "Invite ID is required" }, { status: 400 })
    }

    const { context, rateLimited } = await safeGetOrgContext(orgId)
    if (rateLimited) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again in a moment." },
        { status: 429, headers: { "Retry-After": "30" } },
      )
    }

    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only admins and owners can cancel invites
    if (!hasMinRole(context.role, "admin")) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 })
    }

    const serviceDb = await createServiceDatabaseClient()

    const { error } = await serviceDb
      .from("organization_invites")
      .update({ status: "cancelled" })
      .eq("id", inviteId)
      .eq("org_id", orgId)

    if (error) {
      console.error("[v0] Error cancelling invite:", error)
      return NextResponse.json({ error: "Failed to cancel invite" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[v0] Unexpected error in DELETE invite:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

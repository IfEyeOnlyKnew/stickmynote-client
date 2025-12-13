import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/server"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

// PATCH /api/organizations/[orgId]/members/[memberId] - Update member role
export async function PATCH(req: Request, { params }: { params: Promise<{ orgId: string; memberId: string }> }) {
  try {
    const { orgId, memberId } = await params
    const supabase = await createClient()
    const authResult = await getCachedAuthUser(supabase)

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
    const serviceClient = createServiceClient()

    // Check admin/owner role
    const { data: myMembership, error: memberError } = await serviceClient
      .from("organization_members")
      .select("role")
      .eq("org_id", orgId)
      .eq("user_id", user.id)
      .maybeSingle()

    if (memberError || !myMembership) {
      return NextResponse.json({ error: "Not a member of this organization" }, { status: 403 })
    }

    if (myMembership.role !== "owner" && myMembership.role !== "admin") {
      return NextResponse.json({ error: "Only owners and admins can update members" }, { status: 403 })
    }

    // Get target member
    const { data: targetMember, error: targetError } = await serviceClient
      .from("organization_members")
      .select("role, user_id")
      .eq("id", memberId)
      .eq("org_id", orgId)
      .maybeSingle()

    if (targetError || !targetMember) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 })
    }

    // Cannot modify owner
    if (targetMember.role === "owner") {
      return NextResponse.json({ error: "Cannot modify owner role" }, { status: 400 })
    }

    // Admins cannot modify other admins
    if (myMembership.role === "admin" && targetMember.role === "admin") {
      return NextResponse.json({ error: "Admins cannot modify other admins" }, { status: 403 })
    }

    const body = await req.json()
    const { role } = body

    if (!role || !["admin", "member", "viewer"].includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 })
    }

    // Only owner can promote to admin
    if (role === "admin" && myMembership.role !== "owner") {
      return NextResponse.json({ error: "Only owners can promote to admin" }, { status: 403 })
    }

    const { error: updateError } = await serviceClient
      .from("organization_members")
      .update({ role, updated_at: new Date().toISOString() })
      .eq("id", memberId)

    if (updateError) {
      console.error("[v0] Error updating member:", updateError)
      return NextResponse.json({ error: "Failed to update member" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[v0] Unexpected error in PATCH /api/organizations/[orgId]/members/[memberId]:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE /api/organizations/[orgId]/members/[memberId] - Remove member
export async function DELETE(req: Request, { params }: { params: Promise<{ orgId: string; memberId: string }> }) {
  try {
    const { orgId, memberId } = await params
    const supabase = await createClient()
    const authResult = await getCachedAuthUser(supabase)

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
    const serviceClient = createServiceClient()

    // Check admin/owner role
    const { data: myMembership, error: memberError } = await serviceClient
      .from("organization_members")
      .select("role")
      .eq("org_id", orgId)
      .eq("user_id", user.id)
      .maybeSingle()

    if (memberError || !myMembership) {
      return NextResponse.json({ error: "Not a member of this organization" }, { status: 403 })
    }

    if (myMembership.role !== "owner" && myMembership.role !== "admin") {
      return NextResponse.json({ error: "Only owners and admins can remove members" }, { status: 403 })
    }

    // Get target member
    const { data: targetMember, error: targetError } = await serviceClient
      .from("organization_members")
      .select("role, user_id")
      .eq("id", memberId)
      .eq("org_id", orgId)
      .maybeSingle()

    if (targetError || !targetMember) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 })
    }

    // Cannot remove owner
    if (targetMember.role === "owner") {
      return NextResponse.json({ error: "Cannot remove owner" }, { status: 400 })
    }

    // Cannot remove yourself
    if (targetMember.user_id === user.id) {
      return NextResponse.json({ error: "Cannot remove yourself" }, { status: 400 })
    }

    // Admins cannot remove other admins
    if (myMembership.role === "admin" && targetMember.role === "admin") {
      return NextResponse.json({ error: "Admins cannot remove other admins" }, { status: 403 })
    }

    const { error: deleteError } = await serviceClient.from("organization_members").delete().eq("id", memberId)

    if (deleteError) {
      console.error("[v0] Error removing member:", deleteError)
      return NextResponse.json({ error: "Failed to remove member" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[v0] Unexpected error in DELETE /api/organizations/[orgId]/members/[memberId]:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

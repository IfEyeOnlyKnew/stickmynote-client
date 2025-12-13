import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

export async function PATCH(request: Request, { params }: { params: { padId: string; memberId: string } }) {
  try {
    const supabase = await createClient()
    const authResult = await getCachedAuthUser(supabase)
    if (authResult.rateLimited) {
      return NextResponse.json({ error: "Rate limited" }, { status: 429, headers: { "Retry-After": "30" } })
    }
    if (!authResult.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const user = authResult.user

    const { padId, memberId } = params
    const permissions = await request.json()

    // Check if current user is owner or admin
    const { data: currentMembership } = await supabase
      .from("social_pad_members")
      .select("admin_level")
      .eq("social_pad_id", padId)
      .eq("user_id", user.id)
      .eq("accepted", true)
      .maybeSingle()

    // Get pad owner
    const { data: pad } = await supabase.from("social_pads").select("owner_id").eq("id", padId).maybeSingle()

    const isOwner = pad?.owner_id === user.id
    const isAdmin = currentMembership?.admin_level === "admin"

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: "Only owners and admins can change permissions" }, { status: 403 })
    }

    // Validate permission fields
    const validPermissions = {
      can_create_sticks: permissions.can_create_sticks,
      can_reply: permissions.can_reply,
      can_edit_others_sticks: permissions.can_edit_others_sticks,
      can_delete_others_sticks: permissions.can_delete_others_sticks,
      can_invite_members: permissions.can_invite_members,
      can_pin_sticks: permissions.can_pin_sticks,
    }

    // Update permissions
    const { data: updatedMember, error } = await supabase
      .from("social_pad_members")
      .update(validPermissions)
      .eq("id", memberId)
      .eq("social_pad_id", padId)
      .select()
      .maybeSingle()

    if (error) throw error

    return NextResponse.json({ member: updatedMember })
  } catch (error) {
    console.error("Error updating member permissions:", error)
    return NextResponse.json({ error: "Failed to update permissions" }, { status: 500 })
  }
}

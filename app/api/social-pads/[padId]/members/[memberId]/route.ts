import { createServerClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

export async function PATCH(request: NextRequest, { params }: { params: { padId: string; memberId: string } }) {
  try {
    const supabase = await createServerClient()

    const authResult = await getCachedAuthUser(supabase)
    if (authResult.rateLimited) {
      return NextResponse.json({ error: "Rate limited" }, { status: 429, headers: { "Retry-After": "30" } })
    }
    if (!authResult.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const user = authResult.user

    // Check if user is owner of the pad
    const { data: membership } = await supabase
      .from("social_pad_members")
      .select("admin_level")
      .eq("social_pad_id", params.padId)
      .eq("user_id", user.id)
      .maybeSingle()

    if (!membership || membership.admin_level !== "owner") {
      return NextResponse.json({ error: "Only owners can modify admin permissions" }, { status: 403 })
    }

    const body = await request.json()
    const { admin_level } = body

    if (!["owner", "admin", "member"].includes(admin_level)) {
      return NextResponse.json({ error: "Invalid admin level" }, { status: 400 })
    }

    // Prevent changing owner's admin level
    const { data: targetMember } = await supabase
      .from("social_pad_members")
      .select("admin_level")
      .eq("id", params.memberId)
      .maybeSingle()

    if (targetMember?.admin_level === "owner" && admin_level !== "owner") {
      return NextResponse.json({ error: "Cannot change owner's admin level" }, { status: 400 })
    }

    const { data: updatedMember, error } = await supabase
      .from("social_pad_members")
      .update({ admin_level })
      .eq("id", params.memberId)
      .eq("social_pad_id", params.padId)
      .select()
      .maybeSingle()

    if (error) throw error

    return NextResponse.json({ member: updatedMember })
  } catch (error) {
    console.error("Error updating member:", error)
    return NextResponse.json({ error: "Failed to update member" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { padId: string; memberId: string } }) {
  try {
    const supabase = await createServerClient()

    const authResult = await getCachedAuthUser(supabase)
    if (authResult.rateLimited) {
      return NextResponse.json({ error: "Rate limited" }, { status: 429, headers: { "Retry-After": "30" } })
    }
    if (!authResult.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const user = authResult.user

    // Check if user is owner of the pad
    const { data: membership } = await supabase
      .from("social_pad_members")
      .select("admin_level")
      .eq("social_pad_id", params.padId)
      .eq("user_id", user.id)
      .maybeSingle()

    if (!membership || membership.admin_level !== "owner") {
      return NextResponse.json({ error: "Only owners can remove members" }, { status: 403 })
    }

    // Prevent removing owner
    const { data: targetMember } = await supabase
      .from("social_pad_members")
      .select("admin_level")
      .eq("id", params.memberId)
      .maybeSingle()

    if (targetMember?.admin_level === "owner") {
      return NextResponse.json({ error: "Cannot remove owner" }, { status: 400 })
    }

    const { error } = await supabase
      .from("social_pad_members")
      .delete()
      .eq("id", params.memberId)
      .eq("social_pad_id", params.padId)

    if (error) throw error

    return NextResponse.json({ message: "Member removed successfully" })
  } catch (error) {
    console.error("Error removing member:", error)
    return NextResponse.json({ error: "Failed to remove member" }, { status: 500 })
  }
}

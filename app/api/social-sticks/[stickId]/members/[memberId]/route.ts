import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from "@/lib/auth/cached-auth"

export async function DELETE(request: Request, { params }: { params: { stickId: string; memberId: string } }) {
  try {
    const supabase = await createClient()
    const authResult = await getCachedAuthUser(supabase)

    if (authResult.rateLimited) {
      return createRateLimitResponse()
    }

    if (!authResult.user) {
      return createUnauthorizedResponse()
    }

    const user = authResult.user

    const { data: stick } = await supabase
      .from("social_sticks")
      .select("social_pad_id, social_pads!inner(owner_id)")
      .eq("id", params.stickId)
      .maybeSingle()

    if (!stick) {
      return NextResponse.json({ error: "Stick not found" }, { status: 404 })
    }

    // Type assertion to access owner_id from the joined social_pads
    const socialPads = stick.social_pads as unknown as { owner_id: string }
    const isOwner = socialPads.owner_id === user.id

    const { data: padMember } = await supabase
      .from("social_pad_members")
      .select("role")
      .eq("social_pad_id", stick.social_pad_id)
      .eq("user_id", user.id)
      .maybeSingle()

    const isAdmin = padMember?.role === "admin"

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: "Only pad owners and admins can manage stick members" }, { status: 403 })
    }

    // Delete the member
    const { error: deleteError } = await supabase
      .from("social_stick_members")
      .delete()
      .eq("id", params.memberId)
      .eq("social_stick_id", params.stickId)

    if (deleteError) throw deleteError

    return NextResponse.json({ message: "Member removed successfully" })
  } catch (error) {
    console.error("Error removing stick member:", error)
    return NextResponse.json({ error: "Failed to remove stick member" }, { status: 500 })
  }
}

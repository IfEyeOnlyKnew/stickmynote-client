import { createDatabaseClient } from "@/lib/database/database-adapter"
import { NextResponse } from "next/server"
import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from "@/lib/auth/cached-auth"

export async function DELETE(request: Request, { params }: { params: Promise<{ stickId: string; memberId: string }> }) {
  try {
    const db = await createDatabaseClient()
    const authResult = await getCachedAuthUser()

    if (authResult.rateLimited) {
      return createRateLimitResponse()
    }

    if (!authResult.user) {
      return createUnauthorizedResponse()
    }

    const user = authResult.user

    const { stickId, memberId } = await params

    const { data: stick } = await db
      .from("social_sticks")
      .select("social_pad_id")
      .eq("id", stickId)
      .maybeSingle()

    if (!stick) {
      return NextResponse.json({ error: "Stick not found" }, { status: 404 })
    }

    // Fetch pad owner separately
    const { data: pad } = await db
      .from("social_pads")
      .select("owner_id")
      .eq("id", stick.social_pad_id)
      .maybeSingle()

    const isOwner = pad?.owner_id === user.id

    const { data: padMember } = await db
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
    const { error: deleteError } = await db
      .from("social_stick_members")
      .delete()
      .eq("id", memberId)
      .eq("social_stick_id", stickId)

    if (deleteError) throw deleteError

    return NextResponse.json({ message: "Member removed successfully" })
  } catch (error) {
    console.error("Error removing stick member:", error)
    return NextResponse.json({ error: "Failed to remove stick member" }, { status: 500 })
  }
}

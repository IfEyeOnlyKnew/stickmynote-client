import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

export async function POST(request: Request, { params }: { params: { padId: string } }) {
  try {
    const { padId } = params
    const supabase = await createClient()

    const authResult = await getCachedAuthUser(supabase)
    if (authResult.rateLimited) {
      return NextResponse.json({ error: "Rate limited" }, { status: 429, headers: { "Retry-After": "30" } })
    }
    if (!authResult.user) {
      console.error("[v0] Process pending invites - Auth error")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const user = authResult.user

    console.log("[v0] Process pending invites - User:", user.email, "Pad:", padId)

    // Check for pending invites for this user's email
    const { data: pendingInvites, error: fetchError } = await supabase
      .from("social_pad_pending_invites")
      .select("*")
      .eq("email", user.email)
      .eq("social_pad_id", padId)

    if (fetchError) {
      console.error("[v0] Process pending invites - Fetch error:", fetchError)
      return NextResponse.json({ error: "Failed to fetch pending invites" }, { status: 500 })
    }

    if (!pendingInvites || pendingInvites.length === 0) {
      console.log("[v0] Process pending invites - No pending invites found")
      return NextResponse.json({ message: "No pending invites found" }, { status: 200 })
    }

    console.log("[v0] Process pending invites - Found", pendingInvites.length, "pending invites")

    const results = []

    for (const invite of pendingInvites) {
      // Check if already a member
      const { data: existingMember } = await supabase
        .from("social_pad_members")
        .select("id")
        .eq("social_pad_id", padId)
        .eq("user_id", user.id)
        .maybeSingle()

      if (existingMember) {
        console.log("[v0] Process pending invites - User already a member, deleting invite")
        // Delete the pending invite
        await supabase.from("social_pad_pending_invites").delete().eq("id", invite.id)
        results.push({ invite_id: invite.id, status: "already_member" })
        continue
      }

      // Create membership
      const { error: memberError } = await supabase.from("social_pad_members").insert({
        social_pad_id: padId,
        user_id: user.id,
        role: invite.role,
        accepted: true,
        invited_by: invite.invited_by,
      })

      if (memberError) {
        console.error("[v0] Process pending invites - Error creating membership:", memberError)
        results.push({ invite_id: invite.id, status: "error", error: memberError.message })
        continue
      }

      console.log("[v0] Process pending invites - Created membership")

      // Delete the processed invite
      const { error: deleteError } = await supabase.from("social_pad_pending_invites").delete().eq("id", invite.id)

      if (deleteError) {
        console.error("[v0] Process pending invites - Error deleting invite:", deleteError)
      }

      results.push({ invite_id: invite.id, status: "processed" })
    }

    console.log("[v0] Process pending invites - Results:", results)

    return NextResponse.json({
      message: "Pending invites processed",
      results,
    })
  } catch (error) {
    console.error("[v0] Process pending invites - Unexpected error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

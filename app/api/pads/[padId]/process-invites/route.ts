import { createServerClient, createServiceClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

export async function POST(request: Request, { params }: { params: { padId: string } }) {
  try {
    const supabase = await createServerClient()

    const authResult = await getCachedAuthUser(supabase)
    if (authResult.rateLimited) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again in a moment." },
        { status: 429, headers: { "Retry-After": "30" } },
      )
    }
    if (!authResult.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }
    const user = authResult.user

    const userEmail = user.email
    if (!userEmail) {
      return NextResponse.json({ error: "User email not found" }, { status: 400 })
    }

    const { padId } = params

    const { data: pendingInvites, error: fetchError } = await supabase
      .from("paks_pad_pending_invites")
      .select("*")
      .eq("pad_id", padId)
      .eq("email", userEmail)

    if (fetchError) {
      console.error("[v0] Error fetching pending invites:", fetchError)
      return NextResponse.json({ error: "Error fetching invites" }, { status: 500 })
    }

    if (!pendingInvites || pendingInvites.length === 0) {
      return NextResponse.json({
        success: true,
        processed: false,
        message: "No pending invites found",
      })
    }

    const supabaseAdmin = createServiceClient()

    for (const invite of pendingInvites) {
      const { data: existingMember } = await supabase
        .from("paks_pad_members")
        .select("id")
        .eq("pad_id", invite.pad_id)
        .eq("user_id", user.id)
        .maybeSingle()

      if (existingMember) {
        await supabaseAdmin.from("paks_pad_pending_invites").delete().eq("id", invite.id)
        continue
      }

      const { error: memberError } = await supabaseAdmin.from("paks_pad_members").insert({
        pad_id: invite.pad_id,
        user_id: user.id,
        role: invite.role,
        accepted: true,
        invited_by: invite.invited_by,
        joined_at: new Date().toISOString(),
      })

      if (memberError) {
        console.error("[v0] Error creating pad membership:", memberError)
        return NextResponse.json(
          {
            error: "Error creating membership",
            details: memberError.message,
          },
          { status: 500 },
        )
      }

      const { error: deleteError } = await supabaseAdmin.from("paks_pad_pending_invites").delete().eq("id", invite.id)

      if (deleteError) {
        console.error("[v0] Error deleting pending invite:", deleteError)
      }
    }

    return NextResponse.json({
      success: true,
      processed: true,
      message: "Invitations processed successfully",
    })
  } catch (error) {
    console.error("[v0] Error processing pad invites:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

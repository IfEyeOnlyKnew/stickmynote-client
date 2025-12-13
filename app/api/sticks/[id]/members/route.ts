import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from "@/lib/auth/cached-auth"
import { createServerClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createServerClient()
    const authResult = await getCachedAuthUser(supabase)

    if (authResult.rateLimited) {
      return createRateLimitResponse()
    }

    if (!authResult.user) {
      return createUnauthorizedResponse()
    }

    const user = authResult.user

    const stickId = params.id
    const body = await request.json()
    const { email, role = "viewer" } = body

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 })
    }

    const { data: stick } = await supabase
      .from("paks_pad_sticks")
      .select("user_id, pad_id, title")
      .eq("id", stickId)
      .maybeSingle()

    if (!stick || stick.user_id !== user.id) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 })
    }

    const { data: pad } = await supabase.from("paks_pads").select("id, title").eq("id", stick.pad_id).maybeSingle()

    // Find the user by email
    const { data: invitedUser } = await supabase
      .from("users")
      .select("id, email, username")
      .eq("email", email)
      .maybeSingle()

    if (!invitedUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const { data: existingMember } = await supabase
      .from("paks_pad_stick_members")
      .select("*")
      .eq("stick_id", stickId)
      .eq("user_id", invitedUser.id)
      .maybeSingle()

    if (existingMember) {
      return NextResponse.json({ error: "User is already a member" }, { status: 400 })
    }

    const { error: insertError } = await supabase.from("paks_pad_stick_members").insert({
      stick_id: stickId,
      user_id: invitedUser.id,
      role,
      invited_by: user.id,
    })

    if (insertError) {
      console.error("[v0] Error adding stick member:", insertError)
      return NextResponse.json({ error: "Failed to add member" }, { status: 500 })
    }

    // Send invitation email
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
    const inviteLink = `${siteUrl}/pads/${stick.pad_id}?stick=${stickId}`

    try {
      await fetch(`${siteUrl}/api/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: email,
          subject: `You've been invited to collaborate on "${stick.title}"`,
          html: `
            <h2>Stick Invitation</h2>
            <p>You've been invited to collaborate on the stick "${stick.title}" in the pad "${pad?.title || "Untitled Pad"}".</p>
            <p>Role: ${role}</p>
            <p><a href="${inviteLink}">Click here to view the stick</a></p>
          `,
        }),
      })
    } catch (emailError) {
      console.error("[v0] Error sending invitation email:", emailError)
      // Don't fail the request if email fails
    }

    return NextResponse.json({
      success: true,
      message: "Member added successfully",
      inviteLink,
    })
  } catch (error) {
    console.error("[v0] Error in POST /api/sticks/[id]/members:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createServerClient()
    const authResult = await getCachedAuthUser(supabase)

    if (authResult.rateLimited) {
      return createRateLimitResponse()
    }

    if (!authResult.user) {
      return createUnauthorizedResponse()
    }

    const user = authResult.user

    const stickId = params.id
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("userId")

    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 })
    }

    const { data: stick } = await supabase.from("paks_pad_sticks").select("user_id").eq("id", stickId).maybeSingle()

    if (!stick || stick.user_id !== user.id) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 })
    }

    const { error: deleteError } = await supabase
      .from("paks_pad_stick_members")
      .delete()
      .eq("stick_id", stickId)
      .eq("user_id", userId)

    if (deleteError) {
      console.error("[v0] Error removing stick member:", deleteError)
      return NextResponse.json({ error: "Failed to remove member" }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: "Member removed successfully" })
  } catch (error) {
    console.error("[v0] Error in DELETE /api/sticks/[id]/members:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createServerClient()
    const authResult = await getCachedAuthUser(supabase)

    if (authResult.rateLimited) {
      return createRateLimitResponse()
    }

    if (!authResult.user) {
      return createUnauthorizedResponse()
    }

    const stickId = params.id

    const { data: members, error } = await supabase
      .from("paks_pad_stick_members")
      .select(`
        *,
        users:user_id (
          id,
          email,
          username,
          full_name,
          avatar_url
        )
      `)
      .eq("stick_id", stickId)

    if (error) {
      console.error("[v0] Error fetching stick members:", error)
      return NextResponse.json({ error: "Failed to fetch members" }, { status: 500 })
    }

    return NextResponse.json({ members: members || [] })
  } catch (error) {
    console.error("[v0] Error in GET /api/sticks/[id]/members:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

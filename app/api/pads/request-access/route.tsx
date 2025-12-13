import { createServerClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const supabase = await createServerClient()

    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { padId, message } = await request.json()

    if (!padId) {
      return NextResponse.json({ error: "Pad ID is required" }, { status: 400 })
    }

    // Check if user already has access
    const { data: existingMember } = await supabase
      .from("paks_pad_members")
      .select("id")
      .eq("pad_id", padId)
      .eq("user_id", user.id)
      .single()

    if (existingMember) {
      return NextResponse.json({ error: "You already have access to this Pad" }, { status: 400 })
    }

    // Check if user is the owner
    const { data: pad } = await supabase.from("paks_pads").select("owner_id").eq("id", padId).single()

    if (pad && pad.owner_id === user.id) {
      return NextResponse.json({ error: "You are the owner of this Pad" }, { status: 400 })
    }

    // Check if there's already a pending request
    const { data: existingRequest } = await supabase
      .from("paks_pad_access_requests")
      .select("id, status")
      .eq("pad_id", padId)
      .eq("user_id", user.id)
      .single()

    if (existingRequest && existingRequest.status === "pending") {
      return NextResponse.json({ error: "You already have a pending request for this Pad" }, { status: 400 })
    }

    // Create or update access request
    const { data: accessRequest, error: requestError } = await supabase
      .from("paks_pad_access_requests")
      .upsert(
        {
          pad_id: padId,
          user_id: user.id,
          status: "pending",
          message: message || null,
        },
        {
          onConflict: "pad_id,user_id",
        },
      )
      .select()
      .single()

    if (requestError) {
      console.error("[v0] Error creating access request:", requestError)
      return NextResponse.json({ error: "Failed to create access request" }, { status: 500 })
    }

    // Get Pad details and owner/admin information
    const { data: padDetails, error: padError } = await supabase
      .from("paks_pads")
      .select(
        `
        name,
        owner_id,
        users!paks_pads_owner_id_fkey(
          email,
          username
        )
      `,
      )
      .eq("id", padId)
      .single()

    if (padError) {
      console.error("[v0] Error fetching Pad details:", padError)
      return NextResponse.json({
        success: true,
        message: "Access request created, but notification failed",
      })
    }

    // Get admin members
    const { data: adminMembers } = await supabase
      .from("paks_pad_members")
      .select(
        `
        users!paks_pad_members_user_id_fkey(
          email,
          username
        )
      `,
      )
      .eq("pad_id", padId)
      .eq("role", "admin")
      .eq("accepted", true)

    // Get requester details
    const { data: requester } = await supabase.from("users").select("email, username").eq("id", user.id).single()

    // Collect all recipients (owner + admins)
    const recipients: Array<{ email: string; username: string }> = []

    // Add owner
    if (
      padDetails?.users &&
      typeof padDetails.users === "object" &&
      "email" in padDetails.users &&
      "username" in padDetails.users &&
      typeof padDetails.users.email === "string" &&
      typeof padDetails.users.username === "string"
    ) {
      recipients.push({
        email: padDetails.users.email,
        username: padDetails.users.username,
      })
    }

    // Add admins
    if (adminMembers && Array.isArray(adminMembers)) {
      adminMembers.forEach((member: any) => {
        if (
          member?.users &&
          typeof member.users === "object" &&
          "email" in member.users &&
          "username" in member.users &&
          typeof member.users.email === "string" &&
          typeof member.users.username === "string"
        ) {
          recipients.push({
            email: member.users.email,
            username: member.users.username,
          })
        }
      })
    }

    // Send email notifications to owners and admins
    if (recipients.length > 0) {
      const emailPromises = recipients.map(async (recipient) => {
        try {
          const response = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/send-email`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              to: recipient.email,
              subject: `Access Request for Pad: ${padDetails.name}`,
              html: `
                <h2>New Access Request</h2>
                <p><strong>${requester?.username || requester?.email || "A user"}</strong> has requested access to your Pad: <strong>${padDetails.name}</strong></p>
                ${message ? `<p><strong>Message:</strong> ${message}</p>` : ""}
                <p>Please log in to your account to review and approve or reject this request.</p>
                <p><a href="${process.env.NEXT_PUBLIC_SITE_URL}/paks">View Pads</a></p>
              `,
            }),
          })

          if (!response.ok) {
            console.error(`[v0] Failed to send email to ${recipient.email}:`, await response.text())
          }
        } catch (emailError) {
          console.error(`[v0] Error sending email to ${recipient.email}:`, emailError)
        }
      })

      await Promise.allSettled(emailPromises)
    }

    return NextResponse.json({
      success: true,
      message: "Access request sent successfully",
    })
  } catch (error) {
    console.error("[v0] Error in request-access route:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

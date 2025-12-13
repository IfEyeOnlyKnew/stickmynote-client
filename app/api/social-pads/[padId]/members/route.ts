import { createClient, createServiceClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

export async function GET(request: Request, { params }: { params: { padId: string } }) {
  try {
    const supabase = await createClient()
    const authResult = await getCachedAuthUser(supabase)

    if (authResult.rateLimited) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again in a moment.", members: [], isOwner: false },
        { status: 429, headers: { "Retry-After": "30" } },
      )
    }

    if (!authResult.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const user = authResult.user

    let orgContext
    try {
      orgContext = await getOrgContext()
    } catch (orgError) {
      if (orgError instanceof Error && orgError.message === "RATE_LIMITED") {
        return NextResponse.json(
          { error: "Rate limit exceeded. Please try again in a moment.", members: [], isOwner: false },
          { status: 429, headers: { "Retry-After": "5" } },
        )
      }
      throw orgError
    }

    if (!orgContext) {
      return NextResponse.json({ error: "Organization context required" }, { status: 401 })
    }

    const { padId } = params

    const { data: pad, error: padError } = await supabase
      .from("social_pads")
      .select("owner_id")
      .eq("id", padId)
      .eq("org_id", orgContext.orgId)
      .maybeSingle()

    if (padError) {
      if (padError.message?.includes("Too Many") || padError.code === "429") {
        return NextResponse.json(
          { error: "Rate limit exceeded. Please try again in a moment.", members: [], isOwner: false },
          { status: 429 },
        )
      }
      console.error("[v0] Error fetching pad:", padError)
      return NextResponse.json({ error: "Failed to fetch pad" }, { status: 500 })
    }

    if (!pad) {
      return NextResponse.json({ error: "Pad not found" }, { status: 404 })
    }

    const { data: membership, error: membershipError } = await supabase
      .from("social_pad_members")
      .select("role")
      .eq("social_pad_id", padId)
      .eq("user_id", user.id)
      .eq("accepted", true)
      .eq("org_id", orgContext.orgId)
      .maybeSingle()

    if (membershipError) {
      if (membershipError.message?.includes("Too Many") || membershipError.code === "429") {
        return NextResponse.json(
          { error: "Rate limit exceeded. Please try again in a moment.", members: [], isOwner: false },
          { status: 429 },
        )
      }
      console.error("[v0] Error checking membership:", membershipError)
    }

    if (!membership && pad.owner_id !== user.id) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    const { data: members, error } = await supabase
      .from("social_pad_members")
      .select("*")
      .eq("social_pad_id", padId)
      .eq("org_id", orgContext.orgId)
      .order("created_at", { ascending: true })

    if (error) {
      if (error.message?.includes("Too Many") || error.code === "429") {
        return NextResponse.json(
          {
            error: "Rate limit exceeded. Please try again in a moment.",
            members: [],
            isOwner: pad.owner_id === user.id,
          },
          { status: 429 },
        )
      }
      console.error("[v0] Error fetching members:", error)
      return NextResponse.json({ error: "Failed to fetch members" }, { status: 500 })
    }

    if (members && members.length > 0) {
      const serviceClient = createServiceClient()
      const userIds = [...new Set(members.map((m) => m.user_id))]
      const { data: users, error: usersError } = await serviceClient
        .from("users")
        .select("id, full_name, username, email, avatar_url, hourly_rate_cents")
        .in("id", userIds)

      if (usersError) {
        if (usersError.message?.includes("Too Many") || usersError.code === "429") {
          return NextResponse.json(
            { members: members.map((m) => ({ ...m, users: null })), isOwner: pad.owner_id === user.id },
            { status: 200 },
          )
        }
        console.error("[v0] Error fetching users:", usersError)
        return NextResponse.json({ error: "Failed to fetch user details" }, { status: 500 })
      }

      const membersWithUsers = members.map((member) => ({
        ...member,
        users: users?.find((u) => u.id === member.user_id) || null,
      }))

      return NextResponse.json({ members: membersWithUsers, isOwner: pad.owner_id === user.id })
    }

    return NextResponse.json({ members: members || [], isOwner: pad.owner_id === user.id })
  } catch (error) {
    console.error("[v0] Error in GET /api/social-pads/[padId]/members:", error)
    const errorMessage = error instanceof Error ? error.message : "Failed to fetch members"
    if (errorMessage === "RATE_LIMITED" || errorMessage.includes("Too Many")) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again in a moment.", members: [], isOwner: false },
        { status: 429, headers: { "Retry-After": "5" } },
      )
    }
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: { params: { padId: string } }) {
  try {
    const supabase = await createClient()

    let serviceClient
    try {
      serviceClient = createServiceClient()
    } catch (serviceError) {
      console.error("[v0] Failed to create service client:", serviceError)
      return NextResponse.json(
        { error: "Server configuration error - service client initialization failed" },
        { status: 500 },
      )
    }

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

    const orgContext = await getOrgContext()
    if (!orgContext) {
      return NextResponse.json({ error: "Organization context required" }, { status: 401 })
    }

    const { padId } = params

    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const { email, role: requestedRole } = body

    const validRoles = ["admin", "editor", "viewer"]
    let role = requestedRole
    if (requestedRole === "member") {
      role = "viewer"
    }
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: `Invalid role. Must be one of: ${validRoles.join(", ")}` }, { status: 400 })
    }

    if (!email || !role) {
      return NextResponse.json({ error: "Email and role are required" }, { status: 400 })
    }

    const { data: pad, error: padError } = await supabase
      .from("social_pads")
      .select("owner_id, name")
      .eq("id", padId)
      .eq("org_id", orgContext.orgId)
      .maybeSingle()

    if (padError) {
      console.error("[v0] Error fetching pad:", padError)
      return NextResponse.json({ error: "Failed to fetch pad" }, { status: 500 })
    }

    if (!pad) {
      return NextResponse.json({ error: "Pad not found" }, { status: 404 })
    }

    const { data: membership, error: membershipError } = await supabase
      .from("social_pad_members")
      .select("role")
      .eq("social_pad_id", padId)
      .eq("user_id", user.id)
      .eq("accepted", true)
      .eq("org_id", orgContext.orgId)
      .maybeSingle()

    if (membershipError) {
      console.error("[v0] Error checking membership:", membershipError)
    }

    const canInvite = pad.owner_id === user.id || membership?.role === "admin"

    if (!canInvite) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 })
    }

    const { data: invitedUser, error: userLookupError } = await serviceClient
      .from("users")
      .select("id, email, full_name")
      .eq("email", email)
      .maybeSingle()

    if (userLookupError) {
      console.error("[v0] Error looking up user:", userLookupError)
      return NextResponse.json({ error: "Failed to look up user" }, { status: 500 })
    }

    if (invitedUser) {
      const { data: existingMember, error: existingMemberError } = await serviceClient
        .from("social_pad_members")
        .select("id")
        .eq("social_pad_id", padId)
        .eq("user_id", invitedUser.id)
        .eq("org_id", orgContext.orgId)
        .maybeSingle()

      if (existingMemberError) {
        console.error("[v0] Error checking existing member:", existingMemberError)
        return NextResponse.json({ error: "Failed to check existing membership" }, { status: 500 })
      }

      if (existingMember) {
        return NextResponse.json({ error: "User is already a member of this pad" }, { status: 400 })
      }

      const { data: newMember, error: insertError } = await serviceClient
        .from("social_pad_members")
        .insert({
          social_pad_id: padId,
          user_id: invitedUser.id,
          role,
          invited_by: user.id,
          accepted: true,
          org_id: orgContext.orgId,
        })
        .select("*")
        .maybeSingle()

      if (insertError) {
        console.error("[v0] Error adding member:", insertError)
        return NextResponse.json({ error: `Failed to add member: ${insertError.message}` }, { status: 500 })
      }

      if (!newMember) {
        console.error("[v0] No member returned after insert")
        return NextResponse.json({ error: "Failed to add member - no data returned" }, { status: 500 })
      }

      const { data: userData } = await serviceClient
        .from("users")
        .select("id, full_name, username, email, avatar_url, hourly_rate_cents")
        .eq("id", invitedUser.id)
        .maybeSingle()

      const memberWithUser = {
        ...newMember,
        users: userData || null,
      }

      const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
      const padUrl = `${SITE_URL}/social/pads/${padId}`
      const loginUrl = `${SITE_URL}/auth/login?email=${encodeURIComponent(email)}&redirectTo=${encodeURIComponent(padUrl)}`

      await fetch(`${SITE_URL}/api/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: email,
          subject: `You've been added to "${pad.name}" on Stick My Note`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2>You've been added to a Social Pad!</h2>
              <p>You've been added to the social pad "<strong>${pad.name}</strong>" on Stick My Note with the role of <strong>${role}</strong>.</p>
              <a href="${loginUrl}" style="background-color: #9333ea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block; margin: 16px 0;">
                View ${pad.name}
              </a>
            </div>
          `,
          text: `You've been added to "${pad.name}" with the role of ${role}. Access it at: ${loginUrl}`,
        }),
      }).catch((e) => console.error("[v0] Email send error:", e))

      return NextResponse.json({ member: memberWithUser, userExists: true })
    }

    const { data: existingInvite, error: existingInviteError } = await supabase
      .from("social_pad_pending_invites")
      .select("id")
      .eq("social_pad_id", padId)
      .eq("email", email)
      .eq("org_id", orgContext.orgId)
      .maybeSingle()

    if (existingInviteError) {
      console.error("[v0] Error checking existing invite:", existingInviteError)
      return NextResponse.json({ error: "Failed to check existing invite" }, { status: 500 })
    }

    if (existingInvite) {
      return NextResponse.json({ error: "An invitation has already been sent to this email" }, { status: 400 })
    }

    const { error: inviteError } = await supabase.from("social_pad_pending_invites").insert({
      social_pad_id: padId,
      email,
      role,
      invited_by: user.id,
      org_id: orgContext.orgId,
    })

    if (inviteError) {
      console.error("[v0] Error creating pending invite:", inviteError)
      throw inviteError
    }

    const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
    const padUrl = `${SITE_URL}/social/pads/${padId}`
    const signupUrl = `${SITE_URL}/auth/login?email=${encodeURIComponent(email)}&redirectTo=${encodeURIComponent(padUrl)}`

    await fetch(`${SITE_URL}/api/send-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: email,
        subject: `You've been invited to join "${pad.name}" on Stick My Note`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>You've been invited to join a Social Pad!</h2>
            <p>You've been invited to join "<strong>${pad.name}</strong>" with the role of <strong>${role}</strong>.</p>
            <a href="${signupUrl}" style="background-color: #9333ea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block; margin: 16px 0;">
              Sign In & Join ${pad.name}
            </a>
          </div>
        `,
        text: `You've been invited to join "${pad.name}". Sign up at: ${signupUrl}`,
      }),
    }).catch((e) => console.error("[v0] Email send error:", e))

    return NextResponse.json({
      success: true,
      userExists: false,
      message: "Invitation email sent successfully.",
    })
  } catch (error) {
    console.error("[v0] Error in POST /api/social-pads/[padId]/members:", error)
    const errorMessage = error instanceof Error ? error.message : "Failed to add member"
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: { params: { padId: string } }) {
  try {
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

    const orgContext = await getOrgContext()
    if (!orgContext) {
      return NextResponse.json({ error: "Organization context required" }, { status: 401 })
    }

    const { padId } = params
    const { memberId, role, hourlyRateCents } = await request.json()

    if (!memberId || (!role && hourlyRateCents === undefined)) {
      return NextResponse.json({ error: "Member ID and update data are required" }, { status: 400 })
    }

    const { data: pad } = await supabase
      .from("social_pads")
      .select("owner_id")
      .eq("id", padId)
      .eq("org_id", orgContext.orgId)
      .maybeSingle()

    if (!pad) {
      return NextResponse.json({ error: "Pad not found" }, { status: 404 })
    }

    const { data: membership } = await supabase
      .from("social_pad_members")
      .select("role")
      .eq("social_pad_id", padId)
      .eq("user_id", user.id)
      .eq("accepted", true)
      .eq("org_id", orgContext.orgId)
      .maybeSingle()

    const canUpdate = pad.owner_id === user.id || membership?.role === "admin"

    if (!canUpdate) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 })
    }

    if (role) {
      const { error } = await supabase
        .from("social_pad_members")
        .update({ role })
        .eq("id", memberId)
        .eq("social_pad_id", padId)
        .eq("org_id", orgContext.orgId)

      if (error) throw error
    }

    let updatedUser = null
    if (hourlyRateCents !== undefined) {
      const { data: memberData } = await supabase
        .from("social_pad_members")
        .select("user_id")
        .eq("id", memberId)
        .eq("org_id", orgContext.orgId)
        .maybeSingle()

      if (memberData) {
        const { data, error } = await supabase
          .from("users")
          .update({ hourly_rate_cents: hourlyRateCents })
          .eq("id", memberData.user_id)
          .select("hourly_rate_cents")
          .maybeSingle()

        if (error) throw error
        updatedUser = data
      }
    }

    const { data: updatedMember, error } = await supabase
      .from("social_pad_members")
      .select("*")
      .eq("id", memberId)
      .eq("social_pad_id", padId)
      .eq("org_id", orgContext.orgId)
      .maybeSingle()

    if (error) throw error

    const serviceClient = createServiceClient()
    const { data: userData } = await serviceClient
      .from("users")
      .select("id, full_name, username, email, avatar_url, hourly_rate_cents")
      .eq("id", updatedMember?.user_id)
      .maybeSingle()

    const memberWithUser = {
      ...updatedMember,
      users: userData || null,
    }

    return NextResponse.json({ member: memberWithUser })
  } catch (error) {
    console.error("Error updating member:", error)
    return NextResponse.json({ error: "Failed to update member" }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: { padId: string } }) {
  try {
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

    const orgContext = await getOrgContext()
    if (!orgContext) {
      return NextResponse.json({ error: "Organization context required" }, { status: 401 })
    }

    const { padId } = params
    const { searchParams } = new URL(request.url)
    const memberId = searchParams.get("memberId")

    if (!memberId) {
      return NextResponse.json({ error: "Member ID is required" }, { status: 400 })
    }

    const { data: pad } = await supabase
      .from("social_pads")
      .select("owner_id")
      .eq("id", padId)
      .eq("org_id", orgContext.orgId)
      .maybeSingle()

    if (!pad) {
      return NextResponse.json({ error: "Pad not found" }, { status: 404 })
    }

    const { data: membership } = await supabase
      .from("social_pad_members")
      .select("role")
      .eq("social_pad_id", padId)
      .eq("user_id", user.id)
      .eq("accepted", true)
      .eq("org_id", orgContext.orgId)
      .maybeSingle()

    const canRemove = pad.owner_id === user.id || membership?.role === "admin"

    if (!canRemove) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 })
    }

    const { error } = await supabase
      .from("social_pad_members")
      .delete()
      .eq("id", memberId)
      .eq("social_pad_id", padId)
      .eq("org_id", orgContext.orgId)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error removing member:", error)
    return NextResponse.json({ error: "Failed to remove member" }, { status: 500 })
  }
}

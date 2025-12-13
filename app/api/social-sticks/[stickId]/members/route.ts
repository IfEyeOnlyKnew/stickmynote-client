import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

export async function GET(request: Request, { params }: { params: { stickId: string } }) {
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

    const { data: members, error } = await supabase
      .from("social_stick_members")
      .select("*")
      .eq("social_stick_id", params.stickId)
      .order("granted_at", { ascending: false })

    if (error) throw error

    // Fetch user details for all members
    if (members && members.length > 0) {
      const userIds = [...new Set(members.map((m) => m.user_id))]
      const { data: users, error: usersError } = await supabase
        .from("users")
        .select("id, full_name, username, email, avatar_url")
        .in("id", userIds)

      if (usersError) {
        console.error("Error fetching users:", usersError)
        return NextResponse.json({ error: "Failed to fetch user details" }, { status: 500 })
      }

      const membersWithUsers = members.map((member) => ({
        ...member,
        users: users?.find((u) => u.id === member.user_id) || null,
      }))

      return NextResponse.json({ members: membersWithUsers })
    }

    return NextResponse.json({ members: members || [] })
  } catch (error) {
    console.error("Error fetching stick members:", error)
    return NextResponse.json({ error: "Failed to fetch stick members" }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: { params: { stickId: string } }) {
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
    const { email, padId } = await request.json()

    if (!email?.trim()) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 })
    }

    const { data: stick } = await supabase
      .from("social_sticks")
      .select("social_pad_id, topic, social_pads!inner(owner_id, name)")
      .eq("id", params.stickId)
      .maybeSingle()

    if (!stick) {
      return NextResponse.json({ error: "Stick not found" }, { status: 404 })
    }

    const isOwner = (stick.social_pads as any).owner_id === user.id

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

    const { data: targetUser, error: userError } = await supabase
      .from("users")
      .select("id, email, full_name")
      .eq("email", email.trim())
      .maybeSingle()

    if (userError) {
      console.error("Error looking up user:", userError)
      return NextResponse.json({ error: "Failed to look up user" }, { status: 500 })
    }

    const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
    const padName = (stick.social_pads as any).name
    const stickTopic = stick.topic

    if (targetUser) {
      // User exists - add them directly
      const { data: existingMember } = await supabase
        .from("social_stick_members")
        .select("id")
        .eq("social_stick_id", params.stickId)
        .eq("user_id", targetUser.id)
        .maybeSingle()

      if (existingMember) {
        return NextResponse.json({ error: "User is already a member of this stick" }, { status: 400 })
      }

      // Add user to stick
      const { error: insertError } = await supabase.from("social_stick_members").insert({
        social_stick_id: params.stickId,
        user_id: targetUser.id,
        role: "member",
        granted_by: user.id,
      })

      if (insertError) throw insertError

      // Send notification email
      try {
        const stickUrl = `${SITE_URL}/social/sticks/${params.stickId}`
        const loginUrl = `${SITE_URL}/auth/login?email=${encodeURIComponent(email)}&redirectTo=${encodeURIComponent(stickUrl)}`
        await fetch(`${SITE_URL}/api/send-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: email,
            subject: `You've been added to "${stickTopic}" in ${padName}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2>You've been added to a Stick!</h2>
                <p>You've been added to the stick "<strong>${stickTopic}</strong>" in the pad "<strong>${padName}</strong>" on Stick My Note.</p>
                <p>You can now access this stick:</p>
                <a href="${loginUrl}" 
                   style="background-color: #9333ea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block; margin: 16px 0;">
                  View ${stickTopic}
                </a>
                <p>Happy collaborating!</p>
              </div>
            `,
            text: `You've been added to the stick "${stickTopic}" in the pad "${padName}" on Stick My Note. You can now access it at: ${loginUrl}`,
          }),
        })
      } catch (emailError) {
        console.error("Failed to send notification email:", emailError)
      }

      return NextResponse.json({ message: "Member added successfully and notified via email", userExists: true })
    } else {
      // User doesn't exist - send invitation email
      try {
        const stickUrl = `${SITE_URL}/social/sticks/${params.stickId}`
        const signupUrl = `${SITE_URL}/auth/login?email=${encodeURIComponent(email)}&redirectTo=${encodeURIComponent(stickUrl)}`
        await fetch(`${SITE_URL}/api/send-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: email,
            subject: `You've been invited to "${stickTopic}" in ${padName}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2>You've been invited to a Stick!</h2>
                <p>You've been invited to access the stick "<strong>${stickTopic}</strong>" in the pad "<strong>${padName}</strong>" on Stick My Note.</p>
                <p>To accept this invitation, please sign up for Stick My Note:</p>
                <a href="${signupUrl}" 
                   style="background-color: #9333ea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block; margin: 16px 0;">
                  Sign Up & View ${stickTopic}
                </a>
                <p>After signing up, you'll be able to access this stick and collaborate with other members.</p>
                <p>If you need an access code, please contact the person who invited you.</p>
              </div>
            `,
            text: `You've been invited to access the stick "${stickTopic}" in the pad "${padName}" on Stick My Note. To accept this invitation, please sign up at: ${signupUrl}`,
          }),
        })

        return NextResponse.json({
          message: "Invitation email sent successfully. User will be added when they sign up.",
          userExists: false,
        })
      } catch (emailError) {
        console.error("Failed to send invitation email:", emailError)
        return NextResponse.json({ error: "Failed to send invitation email" }, { status: 500 })
      }
    }
  } catch (error) {
    console.error("Error adding stick member:", error)
    return NextResponse.json({ error: "Failed to add stick member" }, { status: 500 })
  }
}

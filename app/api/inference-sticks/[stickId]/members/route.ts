import { createDatabaseClient } from "@/lib/database/database-adapter"
import { NextResponse } from "next/server"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

// Helper: Validate auth and return user or error response
async function validateAuth() {
  const authResult = await getCachedAuthUser()
  
  if (authResult.rateLimited) {
    return {
      error: NextResponse.json(
        { error: "Rate limit exceeded. Please try again in a moment." },
        { status: 429, headers: { "Retry-After": "30" } },
      ),
    }
  }
  
  if (!authResult.user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }
  
  return { user: authResult.user }
}

// Helper: Build email HTML template
function buildEmailHtml(type: "added" | "invited", stickTopic: string, padName: string, actionUrl: string) {
  const isAdded = type === "added"
  const heading = isAdded ? "You've been added to a Stick!" : "You've been invited to a Stick!"
  const message = isAdded
    ? `You've been added to the stick "<strong>${stickTopic}</strong>" in the pad "<strong>${padName}</strong>" on Stick My Note.`
    : `You've been invited to access the stick "<strong>${stickTopic}</strong>" in the pad "<strong>${padName}</strong>" on Stick My Note.`
  const cta = isAdded ? "You can now access this stick:" : "To accept this invitation, please sign up for Stick My Note:"
  const buttonText = isAdded ? `View ${stickTopic}` : `Sign Up & View ${stickTopic}`
  const footer = isAdded
    ? "<p>Happy collaborating!</p>"
    : "<p>After signing up, you'll be able to access this stick and collaborate with other members.</p><p>If you need an access code, please contact the person who invited you.</p>"

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>${heading}</h2>
      <p>${message}</p>
      <p>${cta}</p>
      <a href="${actionUrl}" 
         style="background-color: #9333ea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block; margin: 16px 0;">
        ${buttonText}
      </a>
      ${footer}
    </div>
  `
}

// Helper: Send notification email
async function sendStickEmail(
  type: "added" | "invited",
  email: string,
  stickTopic: string,
  padName: string,
  stickId: string
) {
  const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
  const stickUrl = `${SITE_URL}/social/sticks/${stickId}`
  const actionUrl = `${SITE_URL}/auth/login?email=${encodeURIComponent(email)}&redirectTo=${encodeURIComponent(stickUrl)}`
  
  const subject = type === "added"
    ? `You've been added to "${stickTopic}" in ${padName}`
    : `You've been invited to "${stickTopic}" in ${padName}`
  
  const textAction = type === "added" ? "access it at" : "sign up at"
  const textMessage = type === "added"
    ? `You've been added to the stick "${stickTopic}" in the pad "${padName}" on Stick My Note.`
    : `You've been invited to access the stick "${stickTopic}" in the pad "${padName}" on Stick My Note.`

  await fetch(`${SITE_URL}/api/send-email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      to: email,
      subject,
      html: buildEmailHtml(type, stickTopic, padName, actionUrl),
      text: `${textMessage} You can ${textAction}: ${actionUrl}`,
    }),
  })
}

// Helper: Add existing user to stick
async function addExistingUserToStick(
  db: any,
  stickId: string,
  targetUser: { id: string },
  grantedBy: string,
  email: string,
  stickTopic: string,
  padName: string
) {
  const { data: existingMember } = await db
    .from("social_stick_members")
    .select("id")
    .eq("social_stick_id", stickId)
    .eq("user_id", targetUser.id)
    .maybeSingle()

  if (existingMember) {
    return NextResponse.json({ error: "User is already a member of this stick" }, { status: 400 })
  }

  const { error: insertError } = await db.from("social_stick_members").insert({
    social_stick_id: stickId,
    user_id: targetUser.id,
    role: "member",
    granted_by: grantedBy,
  })

  if (insertError) throw insertError

  try {
    await sendStickEmail("added", email, stickTopic, padName, stickId)
  } catch (emailError) {
    console.error("Failed to send notification email:", emailError)
  }

  return NextResponse.json({ message: "Member added successfully and notified via email", userExists: true })
}

// Helper: Invite new user via email
async function inviteNewUser(email: string, stickTopic: string, padName: string, stickId: string) {
  try {
    await sendStickEmail("invited", email, stickTopic, padName, stickId)
    return NextResponse.json({
      message: "Invitation email sent successfully. User will be added when they sign up.",
      userExists: false,
    })
  } catch (emailError) {
    console.error("Failed to send invitation email:", emailError)
    return NextResponse.json({ error: "Failed to send invitation email" }, { status: 500 })
  }
}

export async function GET(request: Request, { params }: { params: Promise<{ stickId: string }> }) {
  try {
    const { stickId } = await params
    const db = await createDatabaseClient()
    const auth = await validateAuth()
    if (auth.error) return auth.error

    const { data: members, error } = await db
      .from("social_stick_members")
      .select("*")
      .eq("social_stick_id", stickId)
      .order("granted_at", { ascending: false })

    if (error) throw error
    if (!members || members.length === 0) {
      return NextResponse.json({ members: [] })
    }

    const userIds = [...new Set(members.map((m: any) => m.user_id))]
    const { data: users, error: usersError } = await db
      .from("users")
      .select("id, full_name, username, email, avatar_url")
      .in("id", userIds)

    if (usersError) {
      console.error("Error fetching users:", usersError)
      return NextResponse.json({ error: "Failed to fetch user details" }, { status: 500 })
    }

    const membersWithUsers = members.map((member: any) => ({
      ...member,
      users: users?.find((u: any) => u.id === member.user_id) || null,
    }))

    return NextResponse.json({ members: membersWithUsers })
  } catch (error) {
    console.error("Error fetching stick members:", error)
    return NextResponse.json({ error: "Failed to fetch stick members" }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ stickId: string }> }) {
  try {
    const db = await createDatabaseClient()
    const auth = await validateAuth()
    if (auth.error) return auth.error

    const user = auth.user
    const { email } = await request.json()

    if (!email?.trim()) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 })
    }

    const { stickId } = await params

    const { data: stick } = await db
      .from("social_sticks")
      .select("social_pad_id, topic")
      .eq("id", stickId)
      .maybeSingle()

    if (!stick) {
      return NextResponse.json({ error: "Stick not found" }, { status: 404 })
    }

    // Fetch pad owner and name separately
    const { data: pad } = await db
      .from("social_pads")
      .select("owner_id, name")
      .eq("id", stick.social_pad_id)
      .maybeSingle()

    if (!pad) {
      return NextResponse.json({ error: "Pad not found" }, { status: 404 })
    }

    const isOwner = pad.owner_id === user.id
    const { data: padMember } = await db
      .from("social_pad_members")
      .select("role")
      .eq("social_pad_id", stick.social_pad_id)
      .eq("user_id", user.id)
      .maybeSingle()

    if (!isOwner && padMember?.role !== "admin") {
      return NextResponse.json({ error: "Only pad owners and admins can manage stick members" }, { status: 403 })
    }

    const { data: targetUser, error: userError } = await db
      .from("users")
      .select("id, email, full_name")
      .eq("email", email.trim())
      .maybeSingle()

    if (userError) {
      console.error("Error looking up user:", userError)
      return NextResponse.json({ error: "Failed to look up user" }, { status: 500 })
    }

    const padName = pad.name
    const stickTopic = stick.topic

    if (targetUser) {
      return addExistingUserToStick(db, stickId, targetUser, user.id, email, stickTopic, padName)
    }

    return inviteNewUser(email, stickTopic, padName, stickId)
  } catch (error) {
    console.error("Error adding stick member:", error)
    return NextResponse.json({ error: "Failed to add stick member" }, { status: 500 })
  }
}

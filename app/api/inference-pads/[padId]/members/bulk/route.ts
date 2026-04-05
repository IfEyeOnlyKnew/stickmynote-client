import { createDatabaseClient } from "@/lib/database/database-adapter"
import { NextResponse } from "next/server"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

type ProcessResult = { status: "added" | "invited" | "skipped"; error?: string }

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"

function buildEmailUrl(padId: string, email: string): { padUrl: string; authUrl: string } {
  const padUrl = `${SITE_URL}/social/pads/${padId}`
  const authUrl = `${SITE_URL}/auth/login?email=${encodeURIComponent(email)}&redirectTo=${encodeURIComponent(padUrl)}`
  return { padUrl, authUrl }
}

function buildAddedEmailHtml(padName: string, role: string, loginUrl: string): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>You've been added to a Social Pad!</h2>
      <p>You've been added to the social pad "<strong>${padName}</strong>" on Stick My Note with the role of <strong>${role}</strong>.</p>
      <p>You can now access this pad and all its sticks:</p>
      <a href="${loginUrl}" style="background-color: #9333ea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block; margin: 16px 0;">
        View ${padName}
      </a>
      <p>Happy collaborating!</p>
    </div>
  `
}

function buildInviteEmailHtml(padName: string, role: string, signupUrl: string): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>You've been invited to join a Social Pad!</h2>
      <p>You've been invited to join the social pad "<strong>${padName}</strong>" on Stick My Note with the role of <strong>${role}</strong>.</p>
      <p>To accept this invitation, please sign in or sign up for Stick My Note:</p>
      <a href="${signupUrl}" style="background-color: #9333ea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block; margin: 16px 0;">
        Sign In & Join ${padName}
      </a>
      <p>After signing in, you'll automatically be added to the pad and can start collaborating with other members.</p>
      <p>If you need an access code, please contact the person who invited you.</p>
    </div>
  `
}

async function sendNotificationEmail(email: string, subject: string, html: string, text: string): Promise<void> {
  try {
    await fetch(`${SITE_URL}/api/send-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: email, subject, html, text }),
    })
  } catch (error) {
    console.error(`Failed to send email to ${email}:`, error)
  }
}

async function processExistingUser(
  db: any,
  padId: string,
  email: string,
  userId: string,
  role: string,
  invitedBy: string,
  padName: string
): Promise<ProcessResult> {
  const { data: existingMember } = await db
    .from("social_pad_members")
    .select("id")
    .eq("social_pad_id", padId)
    .eq("user_id", userId)
    .maybeSingle()

  if (existingMember) return { status: "skipped" }

  const { error: insertError } = await db.from("social_pad_members").insert({
    social_pad_id: padId,
    user_id: userId,
    role,
    invited_by: invitedBy,
    accepted: true,
  })

  if (insertError) return { status: "skipped", error: `Failed to add ${email}: ${insertError.message}` }

  const { authUrl } = buildEmailUrl(padId, email)
  await sendNotificationEmail(
    email,
    `You've been added to "${padName}" on Stick My Note`,
    buildAddedEmailHtml(padName, role, authUrl),
    `You've been added to the social pad "${padName}" on Stick My Note with the role of ${role}. You can now access it at: ${authUrl}`
  )

  return { status: "added" }
}

async function processNewUser(
  db: any,
  padId: string,
  email: string,
  role: string,
  invitedBy: string,
  padName: string
): Promise<ProcessResult> {
  const { data: existingInvite } = await db
    .from("social_pad_pending_invites")
    .select("id")
    .eq("social_pad_id", padId)
    .eq("email", email)
    .maybeSingle()

  if (existingInvite) return { status: "skipped" }

  const { error: inviteError } = await db.from("social_pad_pending_invites").insert({
    social_pad_id: padId,
    email,
    role,
    invited_by: invitedBy,
  })

  if (inviteError) return { status: "skipped", error: `Failed to invite ${email}: ${inviteError.message}` }

  const { authUrl } = buildEmailUrl(padId, email)
  await sendNotificationEmail(
    email,
    `You've been invited to join "${padName}" on Stick My Note`,
    buildInviteEmailHtml(padName, role, authUrl),
    `You've been invited to join the social pad "${padName}" on Stick My Note with the role of ${role}. To accept this invitation, please sign in or sign up at: ${authUrl}. After signing in, you'll be automatically added to the pad.`
  )

  return { status: "invited" }
}

async function processEmail(
  db: any,
  padId: string,
  email: string,
  role: string,
  invitedBy: string,
  padName: string
): Promise<ProcessResult> {
  try {
    const { data: invitedUser } = await db.from("users").select("id, email, full_name").eq("email", email).maybeSingle()

    if (invitedUser) {
      return processExistingUser(db, padId, email, invitedUser.id, role, invitedBy, padName)
    }
    return processNewUser(db, padId, email, role, invitedBy, padName)
  } catch (error) {
    console.error(`Error processing ${email}:`, error)
    return { status: "skipped", error: `Error processing ${email}` }
  }
}

function validateInput(emails: unknown, role: unknown): string | null {
  if (!emails || !Array.isArray(emails) || emails.length === 0) return "Emails array is required"
  if (!role || !["admin", "member"].includes(role as string)) return "Valid role is required (admin or member)"
  return null
}

async function checkPermissions(db: any, padId: string, userId: string): Promise<{ pad: any; canInvite: boolean }> {
  const { data: pad } = await db.from("social_pads").select("owner_id, name").eq("id", padId).single()
  if (!pad) return { pad: null, canInvite: false }

  const { data: membership } = await db
    .from("social_pad_members")
    .select("role")
    .eq("social_pad_id", padId)
    .eq("user_id", userId)
    .eq("accepted", true)
    .single()

  const canInvite = pad.owner_id === userId || membership?.role === "admin"
  return { pad, canInvite }
}

export async function POST(request: Request, { params }: { params: Promise<{ padId: string }> }) {
  try {
    const { padId } = await params
    const db = await createDatabaseClient()
    const authResult = await getCachedAuthUser()

    if (authResult.rateLimited) {
      return NextResponse.json({ error: "Rate limited" }, { status: 429, headers: { "Retry-After": "30" } })
    }
    if (!authResult.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const { emails, role } = await request.json()

    const validationError = validateInput(emails, role)
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 })
    }

    const { pad, canInvite } = await checkPermissions(db, padId, authResult.user.id)

    if (!pad) {
      return NextResponse.json({ error: "Pad not found" }, { status: 404 })
    }
    if (!canInvite) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 })
    }

    const results = await Promise.all(
      emails.map((email: string) => processEmail(db, padId, email, role, authResult.user!.id, pad.name))
    )

    const added = results.filter((r) => r.status === "added").length
    const invited = results.filter((r) => r.status === "invited").length
    const skipped = results.filter((r) => r.status === "skipped").length
    const errors = results.filter((r) => r.error).map((r) => r.error!)

    return NextResponse.json({
      added,
      invited,
      skipped,
      errors: errors.length > 0 ? errors : undefined,
      message: `Added ${added} existing user${added === 1 ? "" : "s"}, invited ${invited} new user${invited === 1 ? "" : "s"}` + (skipped > 0 ? `, ${skipped} skipped` : ""),
    })
  } catch (error) {
    console.error("Error bulk inviting members:", error)
    return NextResponse.json({ error: "Failed to invite members" }, { status: 500 })
  }
}

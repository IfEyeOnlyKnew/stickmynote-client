import { createDatabaseClient } from "@/lib/database/database-adapter"
import { NextResponse } from "next/server"
import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from "@/lib/auth/cached-auth"

// Types for processing results
type ProcessResult = { status: "added" | "invited" | "skipped"; error?: string }

interface EmailContext {
  siteUrl: string
  stickId: string
  stickTopic: string
  padName: string
}

// Helper: Build email HTML template
function buildEmailHtml(type: "added" | "invited", stickTopic: string, padName: string, actionUrl: string): string {
  const isAdded = type === "added"
  const heading = isAdded ? "You've been added to a Stick!" : "You've been invited to a Stick!"
  const description = isAdded
    ? `You've been added to the stick "<strong>${stickTopic}</strong>" in the pad "<strong>${padName}</strong>" on Stick My Note.`
    : `You've been invited to access the stick "<strong>${stickTopic}</strong>" in the pad "<strong>${padName}</strong>" on Stick My Note.`
  const callToAction = isAdded ? "You can now access this stick:" : "To accept this invitation, please sign up for Stick My Note:"
  const buttonText = isAdded ? `View ${stickTopic}` : `Sign Up & View ${stickTopic}`
  const footer = isAdded
    ? "<p>Happy collaborating!</p>"
    : "<p>After signing up, you'll be able to access this stick and collaborate with other members.</p><p>If you need an access code, please contact the person who invited you.</p>"

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>${heading}</h2>
      <p>${description}</p>
      <p>${callToAction}</p>
      <a href="${actionUrl}" 
         style="background-color: #9333ea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block; margin: 16px 0;">
        ${buttonText}
      </a>
      ${footer}
    </div>
  `
}

// Helper: Send notification email
async function sendNotificationEmail(
  email: string,
  type: "added" | "invited",
  ctx: EmailContext
): Promise<void> {
  const stickUrl = `${ctx.siteUrl}/social/sticks/${ctx.stickId}`
  const actionUrl = `${ctx.siteUrl}/auth/login?email=${encodeURIComponent(email)}&redirectTo=${encodeURIComponent(stickUrl)}`
  const subject = type === "added"
    ? `You've been added to "${ctx.stickTopic}" in ${ctx.padName}`
    : `You've been invited to "${ctx.stickTopic}" in ${ctx.padName}`
  const textAction = type === "added" ? "access it" : "sign up"

  await fetch(`${ctx.siteUrl}/api/send-email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      to: email,
      subject,
      html: buildEmailHtml(type, ctx.stickTopic, ctx.padName, actionUrl),
      text: `You've been ${type === "added" ? "added to" : "invited to"} the stick "${ctx.stickTopic}" in the pad "${ctx.padName}" on Stick My Note. You can ${textAction} at: ${actionUrl}`,
    }),
  })
}

// Helper: Process a single email for existing user
async function processExistingUser(
  db: Awaited<ReturnType<typeof createDatabaseClient>>,
  email: string,
  targetUserId: string,
  stickId: string,
  grantedBy: string,
  ctx: EmailContext
): Promise<ProcessResult> {
  const { data: existingMember } = await db
    .from("social_stick_members")
    .select("id")
    .eq("social_stick_id", stickId)
    .eq("user_id", targetUserId)
    .maybeSingle()

  if (existingMember) {
    return { status: "skipped" }
  }

  const { error: insertError } = await db.from("social_stick_members").insert({
    social_stick_id: stickId,
    user_id: targetUserId,
    role: "member",
    granted_by: grantedBy,
  })

  if (insertError) {
    return { status: "skipped", error: `Failed to add ${email}: ${insertError.message}` }
  }

  try {
    await sendNotificationEmail(email, "added", ctx)
  } catch (emailError) {
    console.error(`Failed to send notification to ${email}:`, emailError)
  }

  return { status: "added" }
}

// Helper: Process a single email
async function processEmail(
  db: Awaited<ReturnType<typeof createDatabaseClient>>,
  email: string,
  stickId: string,
  grantedBy: string,
  ctx: EmailContext
): Promise<ProcessResult> {
  const { data: targetUser } = await db
    .from("users")
    .select("id, email, full_name")
    .eq("email", email)
    .maybeSingle()

  if (targetUser) {
    return processExistingUser(db, email, targetUser.id, stickId, grantedBy, ctx)
  }

  // User doesn't exist - send invitation email
  try {
    await sendNotificationEmail(email, "invited", ctx)
    return { status: "invited" }
  } catch (emailError) {
    console.error(`Failed to send invitation to ${email}:`, emailError)
    return { status: "skipped", error: `Failed to send invitation to ${email}` }
  }
}

// Helper: Validate request inputs
function validateEmails(emails: unknown): emails is string[] {
  return Array.isArray(emails) && emails.length > 0
}

// Helper: Check user permissions
async function checkPermissions(
  db: Awaited<ReturnType<typeof createDatabaseClient>>,
  stick: { social_pad_id: string; social_pads: { owner_id: string } },
  userId: string
): Promise<boolean> {
  const isOwner = stick.social_pads.owner_id === userId

  if (isOwner) return true

  const { data: padMember } = await db
    .from("social_pad_members")
    .select("role")
    .eq("social_pad_id", stick.social_pad_id)
    .eq("user_id", userId)
    .maybeSingle()

  return padMember?.role === "admin"
}

// Helper: Build response message
function buildResponseMessage(added: number, invited: number, skipped: number): string {
  const addedText = `Added ${added} existing user${added === 1 ? "" : "s"}`
  const invitedText = `invited ${invited} new user${invited === 1 ? "" : "s"}`
  const skippedText = skipped > 0 ? `, ${skipped} skipped` : ""
  return `${addedText}, ${invitedText}${skippedText}`
}

export async function POST(request: Request, { params }: { params: Promise<{ stickId: string }> }) {
  try {
    const db = await createDatabaseClient()
    const authResult = await getCachedAuthUser()

    if (authResult.rateLimited) return createRateLimitResponse()
    if (!authResult.user) return createUnauthorizedResponse()

    const user = authResult.user
    const { stickId } = await params
    const { emails } = await request.json()

    if (!validateEmails(emails)) {
      return NextResponse.json({ error: "Emails array is required" }, { status: 400 })
    }

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

    const socialPads = { owner_id: pad.owner_id, name: pad.name }
    const hasPermission = await checkPermissions(db, { social_pad_id: stick.social_pad_id, social_pads: socialPads }, user.id)
    if (!hasPermission) {
      return NextResponse.json({ error: "Only pad owners and admins can manage stick members" }, { status: 403 })
    }

    const ctx: EmailContext = {
      siteUrl: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
      stickId,
      stickTopic: stick.topic,
      padName: socialPads.name,
    }

    // Process all emails and collect results
    const results = await Promise.all(
      emails.map(async (email: string): Promise<ProcessResult> => {
        try {
          return await processEmail(db, email, stickId, user.id, ctx)
        } catch (error) {
          console.error(`Error processing ${email}:`, error)
          return { status: "skipped", error: `Error processing ${email}` }
        }
      })
    )

    // Aggregate results
    const added = results.filter(r => r.status === "added").length
    const invited = results.filter(r => r.status === "invited").length
    const skipped = results.filter(r => r.status === "skipped").length
    const errors = results.map(r => r.error).filter((e): e is string => !!e)

    return NextResponse.json({
      added,
      invited,
      skipped,
      errors: errors.length > 0 ? errors : undefined,
      message: buildResponseMessage(added, invited, skipped),
    })
  } catch (error) {
    console.error("Error bulk inviting stick members:", error)
    return NextResponse.json({ error: "Failed to invite members" }, { status: 500 })
  }
}

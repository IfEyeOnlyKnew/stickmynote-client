import { type NextRequest, NextResponse } from "next/server"
import { createDatabaseClient } from "@/lib/database/database-adapter"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"
import { getADGroupMembers } from "@/lib/auth/ldap-auth"

/**
 * AD GROUP INVITE API
 *
 * Invite all members of an Active Directory group to a social pad.
 */

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || ""

async function processADGroupMember(
  db: any,
  member: { email: string; dn?: string },
  padId: string,
  pad: { user_id: string; name: string },
  memberRole: string,
  inviterId: string,
): Promise<"added" | "invited" | "skipped"> {
  const { data: existingUser } = await db
    .from("users")
    .select("id, email")
    .or(`email.eq.${member.email},distinguished_name.eq.${member.dn}`)
    .maybeSingle()

  if (existingUser) {
    return processExistingADUser(db, existingUser, padId, pad, memberRole)
  }
  return processNewADUser(db, member, padId, pad, memberRole, inviterId)
}

async function processExistingADUser(
  db: any,
  existingUser: { id: string; email: string },
  padId: string,
  pad: { user_id: string; name: string },
  memberRole: string,
): Promise<"added" | "skipped"> {
  const { data: existingMember } = await db
    .from("social_pad_members")
    .select("id")
    .eq("social_pad_id", padId)
    .eq("user_id", existingUser.id)
    .maybeSingle()

  if (existingMember || pad.user_id === existingUser.id) {
    return "skipped"
  }

  await db.from("social_pad_members").insert({
    social_pad_id: padId,
    user_id: existingUser.id,
    role: memberRole,
    accepted: true,
  })

  sendADGroupEmail(existingUser.email, pad.name, memberRole, `${APP_URL}/social?padId=${padId}`, false).catch(
    (err) => console.warn("[ADGroup] Failed to send notification email:", err),
  )

  return "added"
}

async function processNewADUser(
  db: any,
  member: { email: string },
  padId: string,
  pad: { name: string },
  memberRole: string,
  inviterId: string,
): Promise<"invited" | "skipped"> {
  const { data: existingInvite } = await db
    .from("social_pad_pending_invites")
    .select("id")
    .eq("social_pad_id", padId)
    .eq("email", member.email.toLowerCase())
    .maybeSingle()

  if (existingInvite) {
    return "skipped"
  }

  await db.from("social_pad_pending_invites").insert({
    social_pad_id: padId,
    email: member.email.toLowerCase(),
    role: memberRole,
    invited_by: inviterId,
  })

  sendADGroupEmail(member.email, pad.name, memberRole, `${APP_URL}/signin`, true).catch(
    (err) => console.warn("[ADGroup] Failed to send invitation email:", err),
  )

  return "invited"
}

async function sendADGroupEmail(
  toEmail: string,
  padName: string,
  role: string,
  actionUrl: string,
  isInvite: boolean,
): Promise<void> {
  const heading = isInvite ? "You've been invited to a Social Pad" : "You've been added to a Social Pad"
  const bodyText = isInvite
    ? `You have been invited to join <strong>"${padName}"</strong> as a <strong>${role}</strong>.<br/>This invitation was sent via an Active Directory group.<br/>To accept this invitation, sign up for StickyMyNote using your organization credentials.`
    : `You have been added to <strong>"${padName}"</strong> as a <strong>${role}</strong>.<br/>You were added via an Active Directory group invitation.`
  const buttonText = isInvite ? "Sign Up" : "View Pad"
  const subject = isInvite
    ? `You've been invited to "${padName}" on StickyMyNote`
    : `You've been added to "${padName}" on StickyMyNote`

  await fetch(`${APP_URL}/api/send-email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      to: toEmail,
      subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #9333ea;">${heading}</h2>
          <p>${bodyText}</p>
          <p style="margin-top: 20px;">
            <a href="${actionUrl}" style="background-color: #9333ea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
              ${buttonText}
            </a>
          </p>
        </div>
      `,
    }),
  })
}

// ============================================================================
// POST helpers
// ============================================================================

async function checkPadAdminAccess(
  db: any, padId: string, userId: string,
): Promise<{ pad: any; error?: NextResponse }> {
  const { data: pad, error: padError } = await db
    .from("social_pads")
    .select("id, user_id, name")
    .eq("id", padId)
    .maybeSingle()

  if (padError || !pad) {
    return { pad: null, error: NextResponse.json({ error: "Pad not found" }, { status: 404 }) }
  }

  if (pad.user_id === userId) return { pad }

  const { data: membership } = await db
    .from("social_pad_members")
    .select("role")
    .eq("social_pad_id", padId)
    .eq("user_id", userId)
    .maybeSingle()

  if (membership?.role !== "admin") {
    return { pad: null, error: NextResponse.json({ error: "Only pad owners and admins can invite groups" }, { status: 403 }) }
  }

  return { pad }
}

const VALID_ROLES = new Set(["admin", "editor", "viewer"])

async function processSingleMember(
  db: any,
  member: { email: string; dn?: string },
  padId: string,
  pad: { user_id: string; name: string },
  memberRole: string,
  inviterId: string,
): Promise<{ outcome: "added" | "invited" | "skipped"; error?: string }> {
  if (!member.email) return { outcome: "skipped" }

  try {
    const outcome = await processADGroupMember(db, member, padId, pad, memberRole, inviterId)
    return { outcome }
  } catch (memberErr) {
    const errMsg = memberErr instanceof Error ? memberErr.message : String(memberErr)
    console.error(`[ADGroup] Error processing member ${member.email}:`, memberErr)
    return { outcome: "skipped", error: `Error processing ${member.email}: ${errMsg}` }
  }
}

async function processMembers(
  db: any,
  members: { email: string; dn?: string }[],
  padId: string,
  pad: { user_id: string; name: string },
  memberRole: string,
  inviterId: string,
): Promise<{ added: number; invited: number; skipped: number; errors: string[] }> {
  const counts: Record<string, number> = { added: 0, invited: 0, skipped: 0 }
  const errors: string[] = []

  for (const member of members) {
    const { outcome, error } = await processSingleMember(db, member, padId, pad, memberRole, inviterId)
    counts[outcome]++
    if (error) errors.push(error)
  }

  return { added: counts.added, invited: counts.invited, skipped: counts.skipped, errors }
}

// POST: Invite all members of an AD group
export async function POST(request: NextRequest, { params }: { params: Promise<{ padId: string }> }) {
  try {
    const { padId } = await params
    const db = await createDatabaseClient()

    const authResult = await getCachedAuthUser()
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

    const { pad, error: accessError } = await checkPadAdminAccess(db, padId, user.id)
    if (accessError) return accessError

    const body = await request.json()
    const { groupDn, role } = body

    if (!groupDn) {
      return NextResponse.json({ error: "Group DN is required" }, { status: 400 })
    }

    const memberRole = VALID_ROLES.has(role) ? role : "viewer"

    const groupResult = await getADGroupMembers(groupDn)
    if (!groupResult.success) {
      return NextResponse.json(
        { error: groupResult.error || "Failed to get group members from Active Directory" },
        { status: 500 },
      )
    }

    const members = groupResult.members || []
    if (members.length === 0) {
      return NextResponse.json({ message: "No members found in this group", added: 0, invited: 0, skipped: 0 })
    }

    const result = await processMembers(db, members, padId, pad, memberRole, user.id)

    return NextResponse.json({
      message: `Processed ${members.length} group members: ${result.added} added, ${result.invited} invited, ${result.skipped} skipped`,
      ...result,
      totalMembers: members.length,
      errors: result.errors.length > 0 ? result.errors : undefined,
    })
  } catch (error) {
    console.error("[ADGroup] POST error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

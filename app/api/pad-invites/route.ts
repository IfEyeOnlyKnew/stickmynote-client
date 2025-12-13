import { type NextRequest, NextResponse } from "next/server"
import { createSupabaseServer, createServiceClient } from "@/lib/supabase/server"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

type InviteResult = {
  userId?: string
  email?: string
  reason?: string
}

type InviteResults = {
  success: InviteResult[]
  failed: InviteResult[]
  total: number
}

function mapRoleForDatabase(role: string): "admin" | "edit" | "view" {
  // Normalize to lowercase first
  const normalizedRole = role.toLowerCase()

  const roleMap: Record<string, "admin" | "edit" | "view"> = {
    admin: "admin",
    editor: "edit",
    viewer: "view",
    edit: "edit",
    view: "view",
  }

  const mappedRole = roleMap[normalizedRole] || "view"
  return mappedRole
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServer()

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

    const orgContext = await getOrgContext(user.id)
    if (!orgContext) {
      return NextResponse.json({ error: "No organization context" }, { status: 403 })
    }

    const body = await request.json()

    const { padId, role, userIds, emails } = body

    if (!padId || !role) {
      return NextResponse.json({ error: "Missing padId or role" }, { status: 400 })
    }

    const normalizedRole = role.toLowerCase()
    if (!["admin", "editor", "viewer", "edit", "view"].includes(normalizedRole)) {
      return NextResponse.json({ error: "Invalid role. Must be admin, editor, or viewer" }, { status: 400 })
    }

    const dbRole = mapRoleForDatabase(role)

    const supabaseAdmin = createServiceClient()

    const { data: pad, error: padError } = await supabase
      .from("paks_pads")
      .select("*, paks_pad_members(*)")
      .eq("id", padId)
      .eq("org_id", orgContext.orgId)
      .maybeSingle()

    if (padError || !pad) {
      return NextResponse.json({ error: "Pad not found" }, { status: 404 })
    }

    const isOwner = pad.owner_id === user.id
    const isAdmin = pad.pad_members?.some((m: any) => m.user_id === user.id && m.role === "admin" && m.accepted)
    const isAdminFromPaksPadMembers = pad.paks_pad_members?.some(
      (m: any) => m.user_id === user.id && m.role === "admin" && m.accepted,
    )

    if (!isOwner && !isAdmin && !isAdminFromPaksPadMembers) {
      return NextResponse.json({ error: "Only pad owners or admins can invite members" }, { status: 403 })
    }

    const results: InviteResults = {
      success: [],
      failed: [],
      total: 0,
    }

    if (userIds && userIds.length > 0) {
      for (const userId of userIds) {
        try {
          const { data: existingMember, error: memberCheckError } = await supabaseAdmin
            .from("paks_pad_members")
            .select("*")
            .eq("pad_id", padId)
            .eq("user_id", userId)
            .eq("org_id", orgContext.orgId)
            .maybeSingle()

          if (memberCheckError) {
            results.failed.push({ userId, reason: memberCheckError.message })
            continue
          }

          if (existingMember) {
            results.failed.push({
              userId,
              reason: existingMember.accepted ? "Already a member" : "Invitation already sent",
            })
            continue
          }

          const { data: insertedMember, error: insertError } = await supabaseAdmin
            .from("paks_pad_members")
            .insert({
              pad_id: padId,
              user_id: userId,
              role: dbRole,
              invited_by: user.id,
              invited_at: new Date().toISOString(),
              accepted: true,
              org_id: orgContext.orgId,
            })
            .select()

          if (insertError) {
            results.failed.push({ userId, reason: insertError.message })
          } else {
            const { data: invitedUser } = await supabaseAdmin
              .from("users")
              .select("email, username, full_name")
              .eq("id", userId)
              .maybeSingle()

            if (invitedUser?.email) {
              await sendInvitationEmail({
                toEmail: invitedUser.email,
                toName: invitedUser.full_name || invitedUser.username || "User",
                padName: pad.name,
                role,
                inviterName: user.email || "A team member",
                padLink: `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/pads/${padId}`,
              })
            }

            results.success.push({ userId })
          }
        } catch (err) {
          results.failed.push({ userId, reason: "Unexpected error" })
        }
      }
    }

    if (emails && emails.length > 0) {
      for (const email of emails) {
        try {
          const { data: existingUser, error: userError } = await supabaseAdmin
            .from("users")
            .select("id")
            .eq("email", email)
            .maybeSingle()

          if (userError) {
            results.failed.push({ email, reason: userError.message })
            continue
          }

          if (existingUser) {
            const { data: existingMember, error: memberError } = await supabaseAdmin
              .from("paks_pad_members")
              .select("*")
              .eq("pad_id", padId)
              .eq("user_id", existingUser.id)
              .eq("org_id", orgContext.orgId)
              .maybeSingle()

            if (memberError) {
              results.failed.push({ email, reason: memberError.message })
              continue
            }

            if (existingMember) {
              results.failed.push({
                email,
                reason: existingMember.accepted ? "User already a member" : "Invitation already sent",
              })
              continue
            }

            const { data: insertedMember, error: insertError } = await supabaseAdmin
              .from("paks_pad_members")
              .insert({
                pad_id: padId,
                user_id: existingUser.id,
                role: dbRole,
                invited_by: user.id,
                invited_at: new Date().toISOString(),
                accepted: true,
                org_id: orgContext.orgId,
              })
              .select()

            if (insertError) {
              results.failed.push({ email, reason: insertError.message })
            } else {
              await sendInvitationEmail({
                toEmail: email,
                toName: email.split("@")[0],
                padName: pad.name,
                role,
                inviterName: user.email || "A team member",
                padLink: `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/pads/${padId}`,
              })
              results.success.push({ email })
            }
          } else {
            const { data: existingPendingInvite } = await supabaseAdmin
              .from("paks_pad_pending_invites")
              .select("id")
              .eq("pad_id", padId)
              .eq("email", email)
              .eq("org_id", orgContext.orgId)
              .maybeSingle()

            if (existingPendingInvite) {
              results.failed.push({ email, reason: "Invitation already sent" })
              continue
            }

            const { data: insertedPending, error: pendingError } = await supabaseAdmin
              .from("paks_pad_pending_invites")
              .insert({
                pad_id: padId,
                email,
                role: dbRole,
                invited_by: user.id,
                invited_at: new Date().toISOString(),
                org_id: orgContext.orgId,
              })
              .select()

            if (pendingError) {
              results.failed.push({ email, reason: pendingError.message })
            } else {
              await sendInvitationEmail({
                toEmail: email,
                toName: email.split("@")[0],
                padName: pad.name,
                role,
                inviterName: user.email || "A team member",
                padLink: `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/auth/login?redirect=/pads/${padId}`,
                isNewUser: true,
              })
              results.success.push({ email })
            }
          }
        } catch (err) {
          results.failed.push({ email, reason: "Unexpected error" })
        }
      }
    }

    results.total = results.success.length + results.failed.length

    return NextResponse.json({
      success: true,
      summary: results,
    })
  } catch (error) {
    console.error("Pad invite error:", error)
    return NextResponse.json(
      { error: "Failed to process invitations", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}

async function sendInvitationEmail({
  toEmail,
  toName,
  padName,
  role,
  inviterName,
  padLink,
  isNewUser = false,
}: {
  toEmail: string
  toName: string
  padName: string
  role: string
  inviterName: string
  padLink: string
  isNewUser?: boolean
}) {
  try {
    const normalizedRole = role.toLowerCase()
    const roleDescription: Record<string, string> = {
      admin: "manage members and have full access to all sticks",
      editor: "create and edit sticks",
      edit: "create and edit sticks",
      viewer: "view sticks and replies",
      view: "view sticks and replies",
    }
    const description = roleDescription[normalizedRole] || "access this pad"
    const displayRole =
      normalizedRole === "admin"
        ? "Admin"
        : normalizedRole === "editor" || normalizedRole === "edit"
          ? "Editor"
          : "Viewer"
    const actionLink = isNewUser
      ? `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/auth/login?redirect=${encodeURIComponent(`/pads/${padLink.split("/").pop()}`)}`
      : padLink
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">You've been invited to collaborate!</h2>
        <p>Hello ${toName},</p>
        <p>${inviterName} has invited you to join the pad "<strong>${padName}</strong>" with <strong>${displayRole}</strong> access.</p>
        ${isNewUser ? "<p>You'll need to create an account or log in first. After authenticating, you'll automatically be redirected to the pad.</p>" : "<p>Click the button below to access the pad. You may need to log in first.</p>"}
        <div style="margin: 30px 0;">
          <a href="${actionLink}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            ${isNewUser ? "Log In & Join Pad" : "Accept Invitation"}
          </a>
        </div>
        <p style="color: #666; font-size: 14px;">
          <strong>Access level: ${displayRole}</strong><br>
          As a ${normalizedRole}, you can ${description}.
        </p>
        <p style="color: #999; font-size: 12px; margin-top: 40px;">
          This invitation was sent from Stick My Note. If you weren't expecting this invitation, you can safely ignore this email.
        </p>
      </div>
    `
    await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/api/send-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: toEmail,
        subject: `Invitation to join "${padName}" pad`,
        html,
      }),
    })
  } catch (error) {
    console.error("Error sending invitation email:", error)
  }
}

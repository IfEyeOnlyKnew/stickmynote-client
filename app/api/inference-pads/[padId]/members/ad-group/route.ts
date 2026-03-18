import { type NextRequest, NextResponse } from "next/server"
import { createDatabaseClient } from "@/lib/database/database-adapter"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"
import { getADGroupMembers } from "@/lib/auth/ldap-auth"

/**
 * AD GROUP INVITE API
 *
 * Invite all members of an Active Directory group to a social pad.
 */

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

    // Check if user is owner or admin of the pad
    const { data: pad, error: padError } = await db
      .from("social_pads")
      .select("id, user_id, name")
      .eq("id", padId)
      .maybeSingle()

    if (padError || !pad) {
      return NextResponse.json({ error: "Pad not found" }, { status: 404 })
    }

    const isOwner = pad.user_id === user.id

    // Check if admin
    let isAdmin = false
    if (!isOwner) {
      const { data: membership } = await db
        .from("social_pad_members")
        .select("role")
        .eq("social_pad_id", padId)
        .eq("user_id", user.id)
        .maybeSingle()

      isAdmin = membership?.role === "admin"
    }

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: "Only pad owners and admins can invite groups" }, { status: 403 })
    }

    const body = await request.json()
    const { groupDn, role } = body

    if (!groupDn) {
      return NextResponse.json({ error: "Group DN is required" }, { status: 400 })
    }

    // Validate role
    const validRoles = ["admin", "editor", "viewer"]
    const memberRole = validRoles.includes(role) ? role : "viewer"

    // Get all members of the AD group
    const groupResult = await getADGroupMembers(groupDn)

    if (!groupResult.success) {
      return NextResponse.json(
        { error: groupResult.error || "Failed to get group members from Active Directory" },
        { status: 500 },
      )
    }

    const members = groupResult.members || []

    if (members.length === 0) {
      return NextResponse.json({
        message: "No members found in this group",
        added: 0,
        invited: 0,
        skipped: 0,
      })
    }

    let added = 0
    let invited = 0
    let skipped = 0
    const errors: string[] = []

    // Process each member
    for (const member of members) {
      if (!member.email) {
        skipped++
        continue
      }

      try {
        // Check if user exists in our database
        const { data: existingUser } = await db
          .from("users")
          .select("id, email")
          .or(`email.eq.${member.email},distinguished_name.eq.${member.dn}`)
          .maybeSingle()

        if (existingUser) {
          // User exists - check if already a member
          const { data: existingMember } = await db
            .from("social_pad_members")
            .select("id")
            .eq("social_pad_id", padId)
            .eq("user_id", existingUser.id)
            .maybeSingle()

          if (existingMember) {
            skipped++
            continue
          }

          // Check if user is the pad owner
          if (pad.user_id === existingUser.id) {
            skipped++
            continue
          }

          // Add as member
          await db.from("social_pad_members").insert({
            social_pad_id: padId,
            user_id: existingUser.id,
            role: memberRole,
            accepted: true,
          })

          added++

          // Send notification email (optional, non-blocking)
          try {
            await fetch(`${process.env.NEXT_PUBLIC_APP_URL || ""}/api/send-email`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                to: existingUser.email,
                subject: `You've been added to "${pad.name}" on StickyMyNote`,
                html: `
                  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #9333ea;">You've been added to a Social Pad</h2>
                    <p>You have been added to <strong>"${pad.name}"</strong> as a <strong>${memberRole}</strong>.</p>
                    <p>You were added via an Active Directory group invitation.</p>
                    <p style="margin-top: 20px;">
                      <a href="${process.env.NEXT_PUBLIC_APP_URL}/social?padId=${padId}"
                         style="background-color: #9333ea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
                        View Pad
                      </a>
                    </p>
                  </div>
                `,
              }),
            })
          } catch (emailErr) {
            console.warn("[ADGroup] Failed to send notification email:", emailErr)
          }
        } else {
          // User doesn't exist - check for existing pending invite
          const { data: existingInvite } = await db
            .from("social_pad_pending_invites")
            .select("id")
            .eq("social_pad_id", padId)
            .eq("email", member.email.toLowerCase())
            .maybeSingle()

          if (existingInvite) {
            skipped++
            continue
          }

          // Create pending invite
          await db.from("social_pad_pending_invites").insert({
            social_pad_id: padId,
            email: member.email.toLowerCase(),
            role: memberRole,
            invited_by: user.id,
          })

          invited++

          // Send invitation email
          try {
            await fetch(`${process.env.NEXT_PUBLIC_APP_URL || ""}/api/send-email`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                to: member.email,
                subject: `You've been invited to "${pad.name}" on StickyMyNote`,
                html: `
                  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #9333ea;">You've been invited to a Social Pad</h2>
                    <p>You have been invited to join <strong>"${pad.name}"</strong> as a <strong>${memberRole}</strong>.</p>
                    <p>This invitation was sent via an Active Directory group.</p>
                    <p>To accept this invitation, sign up for StickyMyNote using your organization credentials.</p>
                    <p style="margin-top: 20px;">
                      <a href="${process.env.NEXT_PUBLIC_APP_URL}/signin"
                         style="background-color: #9333ea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
                        Sign Up
                      </a>
                    </p>
                  </div>
                `,
              }),
            })
          } catch (emailErr) {
            console.warn("[ADGroup] Failed to send invitation email:", emailErr)
          }
        }
      } catch (memberErr) {
        const errMsg = memberErr instanceof Error ? memberErr.message : String(memberErr)
        errors.push(`Error processing ${member.email}: ${errMsg}`)
        console.error(`[ADGroup] Error processing member ${member.email}:`, memberErr)
      }
    }

    return NextResponse.json({
      message: `Processed ${members.length} group members: ${added} added, ${invited} invited, ${skipped} skipped`,
      added,
      invited,
      skipped,
      totalMembers: members.length,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    console.error("[ADGroup] POST error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

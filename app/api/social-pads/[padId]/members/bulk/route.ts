import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

export async function POST(request: Request, { params }: { params: { padId: string } }) {
  try {
    const supabase = await createClient()
    const authResult = await getCachedAuthUser(supabase)
    if (authResult.rateLimited) {
      return NextResponse.json({ error: "Rate limited" }, { status: 429, headers: { "Retry-After": "30" } })
    }
    if (!authResult.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const user = authResult.user

    const { padId } = params
    const { emails, role } = await request.json()

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return NextResponse.json({ error: "Emails array is required" }, { status: 400 })
    }

    if (!role || !["admin", "member"].includes(role)) {
      return NextResponse.json({ error: "Valid role is required (admin or member)" }, { status: 400 })
    }

    // Verify user is owner or admin
    const { data: pad } = await supabase.from("social_pads").select("owner_id, name").eq("id", padId).single()

    if (!pad) {
      return NextResponse.json({ error: "Pad not found" }, { status: 404 })
    }

    const { data: membership } = await supabase
      .from("social_pad_members")
      .select("role")
      .eq("social_pad_id", padId)
      .eq("user_id", user.id)
      .eq("accepted", true)
      .single()

    const canInvite = pad.owner_id === user.id || membership?.role === "admin"

    if (!canInvite) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 })
    }

    let added = 0
    let invited = 0
    let skipped = 0
    const errors: string[] = []

    const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"

    for (const email of emails) {
      try {
        const { data: invitedUser } = await supabase
          .from("users")
          .select("id, email, full_name")
          .eq("email", email)
          .maybeSingle()

        if (invitedUser) {
          // Check if already a member
          const { data: existingMember } = await supabase
            .from("social_pad_members")
            .select("id")
            .eq("social_pad_id", padId)
            .eq("user_id", invitedUser.id)
            .maybeSingle()

          if (existingMember) {
            skipped++
            continue
          }

          // Add member
          const { error: insertError } = await supabase.from("social_pad_members").insert({
            social_pad_id: padId,
            user_id: invitedUser.id,
            role,
            invited_by: user.id,
            accepted: true,
          })

          if (insertError) {
            errors.push(`Failed to add ${email}: ${insertError.message}`)
            skipped++
          } else {
            added++

            try {
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
                      <p>You can now access this pad and all its sticks:</p>
                      <a href="${loginUrl}" 
                         style="background-color: #9333ea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block; margin: 16px 0;">
                        View ${pad.name}
                      </a>
                      <p>Happy collaborating!</p>
                    </div>
                  `,
                  text: `You've been added to the social pad "${pad.name}" on Stick My Note with the role of ${role}. You can now access it at: ${loginUrl}`,
                }),
              })
            } catch (emailError) {
              console.error(`Failed to send notification to ${email}:`, emailError)
            }
          }
        } else {
          // Check if already has pending invite
          const { data: existingInvite } = await supabase
            .from("social_pad_pending_invites")
            .select("id")
            .eq("social_pad_id", padId)
            .eq("email", email)
            .maybeSingle()

          if (existingInvite) {
            skipped++
            continue
          }

          // Create pending invite
          const { error: inviteError } = await supabase.from("social_pad_pending_invites").insert({
            social_pad_id: padId,
            email,
            role,
            invited_by: user.id,
          })

          if (inviteError) {
            errors.push(`Failed to invite ${email}: ${inviteError.message}`)
            skipped++
          } else {
            invited++

            try {
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
                      <p>You've been invited to join the social pad "<strong>${pad.name}</strong>" on Stick My Note with the role of <strong>${role}</strong>.</p>
                      <p>To accept this invitation, please sign in or sign up for Stick My Note:</p>
                      <a href="${signupUrl}" 
                         style="background-color: #9333ea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block; margin: 16px 0;">
                        Sign In & Join ${pad.name}
                      </a>
                      <p>After signing in, you'll automatically be added to the pad and can start collaborating with other members.</p>
                      <p>If you need an access code, please contact the person who invited you.</p>
                    </div>
                  `,
                  text: `You've been invited to join the social pad "${pad.name}" on Stick My Note with the role of ${role}. To accept this invitation, please sign in or sign up at: ${signupUrl}. After signing in, you'll be automatically added to the pad.`,
                }),
              })
            } catch (emailError) {
              console.error(`Failed to send invitation to ${email}:`, emailError)
            }
          }
        }
      } catch (error) {
        console.error(`Error processing ${email}:`, error)
        errors.push(`Error processing ${email}`)
        skipped++
      }
    }

    return NextResponse.json({
      added,
      invited,
      skipped,
      errors: errors.length > 0 ? errors : undefined,
      message: `Added ${added} existing user${added !== 1 ? "s" : ""}, invited ${invited} new user${invited !== 1 ? "s" : ""}${skipped > 0 ? `, ${skipped} skipped` : ""}`,
    })
  } catch (error) {
    console.error("Error bulk inviting members:", error)
    return NextResponse.json({ error: "Failed to invite members" }, { status: 500 })
  }
}

import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from "@/lib/auth/cached-auth"

export async function POST(request: Request, { params }: { params: { stickId: string } }) {
  try {
    const supabase = await createClient()
    const authResult = await getCachedAuthUser(supabase)

    if (authResult.rateLimited) {
      return createRateLimitResponse()
    }

    if (!authResult.user) {
      return createUnauthorizedResponse()
    }

    const user = authResult.user
    const { stickId } = params
    const { emails, padId } = await request.json()

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return NextResponse.json({ error: "Emails array is required" }, { status: 400 })
    }

    // Verify user is owner or admin of the pad
    const { data: stick } = await supabase
      .from("social_sticks")
      .select("social_pad_id, topic, social_pads!inner(owner_id, name)")
      .eq("id", stickId)
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

    let added = 0
    let invited = 0
    let skipped = 0
    const errors: string[] = []

    const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
    const padName = (stick.social_pads as any).name
    const stickTopic = stick.topic

    for (const email of emails) {
      try {
        const { data: targetUser } = await supabase
          .from("users")
          .select("id, email, full_name")
          .eq("email", email)
          .maybeSingle()

        if (targetUser) {
          // Check if already a member
          const { data: existingMember } = await supabase
            .from("social_stick_members")
            .select("id")
            .eq("social_stick_id", stickId)
            .eq("user_id", targetUser.id)
            .maybeSingle()

          if (existingMember) {
            skipped++
            continue
          }

          // Add member
          const { error: insertError } = await supabase.from("social_stick_members").insert({
            social_stick_id: stickId,
            user_id: targetUser.id,
            role: "member",
            granted_by: user.id,
          })

          if (insertError) {
            errors.push(`Failed to add ${email}: ${insertError.message}`)
            skipped++
          } else {
            added++

            // Send notification email
            try {
              const stickUrl = `${SITE_URL}/social/sticks/${stickId}`
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
              console.error(`Failed to send notification to ${email}:`, emailError)
            }
          }
        } else {
          // User doesn't exist - send invitation email
          invited++

          try {
            const stickUrl = `${SITE_URL}/social/sticks/${stickId}`
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
          } catch (emailError) {
            console.error(`Failed to send invitation to ${email}:`, emailError)
            errors.push(`Failed to send invitation to ${email}`)
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
    console.error("Error bulk inviting stick members:", error)
    return NextResponse.json({ error: "Failed to invite members" }, { status: 500 })
  }
}

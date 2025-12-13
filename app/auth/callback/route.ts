import { createSupabaseServer } from "@/lib/supabase-server"
import { createClient } from "@supabase/supabase-js"
import { type NextRequest, NextResponse } from "next/server"
import { extractDomain, isPublicEmailDomain, generateOrgNameFromDomain } from "@/lib/utils/email-domain"

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get("code")
  const origin = requestUrl.origin
  const redirectTo = requestUrl.searchParams.get("redirectTo") || "/dashboard"

  if (code) {
    const supabase = await createSupabaseServer()

    try {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code)

      if (error) {
        console.error("Auth callback - Exchange code error:", error)
        return NextResponse.redirect(`${origin}/auth/login?error=callback_error`)
      }

      if (data.session && data.user) {
        try {
          const userEmail = data.user.email

          if (userEmail) {
            const supabaseAdmin = createClient(
              process.env.NEXT_PUBLIC_SUPABASE_URL!,
              process.env.SUPABASE_SERVICE_ROLE_KEY!,
              {
                auth: {
                  autoRefreshToken: false,
                  persistSession: false,
                },
              },
            )

            const domain = extractDomain(userEmail)
            const isPersonalEmail = !domain || isPublicEmailDomain(domain)
            const hubMode = isPersonalEmail ? "personal_only" : "full_access"

            // Check current user profile
            const { data: userProfile, error: profileError } = await supabaseAdmin
              .from("users")
              .select("id, hub_mode")
              .eq("id", data.user.id)
              .single()

            if (!profileError && userProfile) {
              // Set hub_mode if not already set
              if (!userProfile.hub_mode) {
                console.log(`[v0] Setting hub_mode to ${hubMode} for ${userEmail} (domain: ${domain})`)

                const { error: updateError } = await supabaseAdmin
                  .from("users")
                  .update({ hub_mode: hubMode })
                  .eq("id", data.user.id)

                if (updateError) {
                  console.error("[v0] Error setting hub_mode:", updateError)
                } else {
                  console.log(`[v0] Successfully set hub_mode to ${hubMode}`)
                }
              }

              const effectiveHubMode = userProfile.hub_mode || hubMode
              if (effectiveHubMode === "full_access" && domain && !isPersonalEmail) {
                try {
                  // Check if user already has any organization membership
                  const { data: existingMembership } = await supabaseAdmin
                    .from("organization_members")
                    .select("id, org_id")
                    .eq("user_id", data.user.id)
                    .limit(1)
                    .maybeSingle()

                  if (!existingMembership) {
                    console.log(`[v0] User has no organization membership, checking for domain org: ${domain}`)

                    const { data: existingOrg, error: orgFindError } = await supabaseAdmin
                      .from("organizations")
                      .select("id, name, require_preregistration")
                      .eq("domain", domain)
                      .maybeSingle()

                    if (!orgFindError && existingOrg) {
                      if (existingOrg.require_preregistration) {
                        // Check if user is pre-registered in organization_invites
                        const { data: preRegistration } = await supabaseAdmin
                          .from("organization_invites")
                          .select("id, role")
                          .eq("org_id", existingOrg.id)
                          .eq("email", userEmail.toLowerCase())
                          .eq("status", "pre_registered")
                          .maybeSingle()

                        if (preRegistration) {
                          // User is pre-registered - add them to organization
                          const { error: joinError } = await supabaseAdmin.from("organization_members").insert({
                            org_id: existingOrg.id,
                            user_id: data.user.id,
                            role: preRegistration.role || "member",
                            status: "active",
                            joined_at: new Date().toISOString(),
                          })

                          if (joinError) {
                            console.error("[v0] Error joining organization from pre-registration:", joinError)
                          } else {
                            console.log(`[v0] Added pre-registered user to organization: ${existingOrg.name}`)

                            // Update the pre-registration status to 'accepted'
                            await supabaseAdmin
                              .from("organization_invites")
                              .update({ status: "accepted" })
                              .eq("id", preRegistration.id)
                          }
                        } else {
                          // User is NOT pre-registered - deny organization access
                          console.log(
                            `[v0] User ${userEmail} is NOT pre-registered for organization ${existingOrg.name}. Access denied.`,
                          )

                          // Set hub_mode to personal_only since they can't access the organization
                          await supabaseAdmin.from("users").update({ hub_mode: "personal_only" }).eq("id", data.user.id)

                          // Redirect to access denied page
                          return NextResponse.redirect(
                            `${origin}/auth/access-denied?reason=not_preregistered&org=${encodeURIComponent(existingOrg.name)}`,
                          )
                        }
                      } else {
                        // Organization does not require pre-registration - auto-join (legacy behavior)
                        const { error: joinError } = await supabaseAdmin.from("organization_members").insert({
                          org_id: existingOrg.id,
                          user_id: data.user.id,
                          role: "member",
                          joined_at: new Date().toISOString(),
                        })

                        if (joinError) {
                          console.error("[v0] Error joining existing organization:", joinError)
                        } else {
                          console.log(`[v0] Added user to existing organization: ${existingOrg.name}`)
                        }
                      }
                    } else if (!existingOrg) {
                      // Create new organization for this domain
                      const orgName = generateOrgNameFromDomain(domain)
                      const slug = `${domain.replace(/\./g, "-")}-${Math.random().toString(36).substring(2, 7)}`

                      const { data: newOrg, error: createOrgError } = await supabaseAdmin
                        .from("organizations")
                        .insert({
                          name: orgName,
                          slug,
                          type: "team",
                          domain,
                          owner_id: data.user.id,
                          settings: {},
                          require_preregistration: true,
                        })
                        .select()
                        .single()

                      if (!createOrgError && newOrg) {
                        const { error: memberError } = await supabaseAdmin.from("organization_members").insert({
                          org_id: newOrg.id,
                          user_id: data.user.id,
                          role: "owner",
                          joined_at: new Date().toISOString(),
                        })

                        if (memberError) {
                          console.error("[v0] Error adding owner to new organization:", memberError)
                        } else {
                          console.log(`[v0] Created new organization: ${orgName} for domain ${domain}`)
                        }
                      } else if (createOrgError) {
                        console.error("[v0] Error creating organization:", createOrgError)
                      }
                    }
                  } else {
                    console.log(`[v0] User already has organization membership: ${existingMembership.org_id}`)
                  }
                } catch (orgError) {
                  console.error("[v0] Error setting up organization:", orgError)
                }
              }
            }

            // Process pad pending invites
            const { data: padInvites, error: padInvitesError } = await supabaseAdmin
              .from("paks_pad_pending_invites")
              .select("*")
              .eq("email", userEmail)

            if (padInvitesError) {
              console.error("Error fetching pad invites:", padInvitesError)
            } else if (padInvites && padInvites.length > 0) {
              console.log(`[v0] Processing ${padInvites.length} pad invitation(s) for ${userEmail}`)

              for (const invite of padInvites) {
                // Create pad membership
                const { error: memberError } = await supabaseAdmin.from("paks_pad_members").insert({
                  pad_id: invite.pad_id,
                  user_id: data.user.id,
                  role: invite.role,
                  accepted: true,
                  invited_by: invite.invited_by,
                  joined_at: new Date().toISOString(),
                })

                if (memberError) {
                  console.error("[v0] Error creating pad membership:", memberError)
                } else {
                  console.log(`[v0] Successfully added user to pad ${invite.pad_id}`)

                  // Delete the processed pending invite
                  const { error: deleteError } = await supabaseAdmin
                    .from("paks_pad_pending_invites")
                    .delete()
                    .eq("id", invite.id)

                  if (deleteError) {
                    console.error("[v0] Error deleting pad invite:", deleteError)
                  } else {
                    console.log(`[v0] Successfully removed pending invite ${invite.id}`)
                  }
                }
              }
            }

            // Process social pad pending invites
            const { data: socialPadInvites, error: socialPadInvitesError } = await supabaseAdmin
              .from("social_pad_pending_invites")
              .select("*")
              .eq("email", userEmail)

            if (socialPadInvitesError) {
              console.error("Error fetching social pad invites:", socialPadInvitesError)
            } else if (socialPadInvites && socialPadInvites.length > 0) {
              console.log(`[v0] Processing ${socialPadInvites.length} social pad invitation(s) for ${userEmail}`)

              for (const invite of socialPadInvites) {
                // Create social pad membership
                const { error: memberError } = await supabaseAdmin.from("social_pad_members").insert({
                  social_pad_id: invite.social_pad_id,
                  user_id: data.user.id,
                  role: invite.role,
                  accepted: true,
                  invited_by: invite.invited_by,
                  joined_at: new Date().toISOString(),
                })

                if (memberError) {
                  console.error("[v0] Error creating social pad membership:", memberError)
                } else {
                  console.log(`[v0] Successfully added user to social pad ${invite.social_pad_id}`)

                  // Delete the processed pending invite
                  const { error: deleteError } = await supabaseAdmin
                    .from("social_pad_pending_invites")
                    .delete()
                    .eq("id", invite.id)

                  if (deleteError) {
                    console.error("[v0] Error deleting social pad invite:", deleteError)
                  } else {
                    console.log(`[v0] Successfully removed pending social pad invite ${invite.id}`)
                  }
                }
              }
            }
          }
        } catch (inviteError) {
          console.error("[v0] Error processing invitations:", inviteError)
          // Don't fail the login if invitation processing fails
        }

        // Check the user's hub_mode to redirect appropriately
        const supabaseAdmin = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
          {
            auth: {
              autoRefreshToken: false,
              persistSession: false,
            },
          },
        )

        const { data: finalProfile } = await supabaseAdmin
          .from("users")
          .select("hub_mode")
          .eq("id", data.user.id)
          .single()

        // If hub_mode is personal_only, redirect to /notes, otherwise to /dashboard
        const finalRedirect = finalProfile?.hub_mode === "personal_only" ? "/notes" : redirectTo

        return NextResponse.redirect(`${origin}${finalRedirect}?message=email_confirmed`)
      } else {
        console.error("No session after exchange")
        return NextResponse.redirect(`${origin}/auth/login?error=no_session`)
      }
    } catch (err) {
      console.error("Auth callback - Unexpected error:", err)
      return NextResponse.redirect(`${origin}/auth/login?error=callback_error`)
    }
  }

  console.error("Auth callback - No code provided")
  return NextResponse.redirect(`${origin}/auth/login?error=no_code`)
}

import { createServerClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

export async function POST(request: Request) {
  try {
    const supabase = await createServerClient()
    const serviceClient = createServiceClient()

    const authResult = await getCachedAuthUser(supabase)
    if (authResult.rateLimited) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again in a moment." },
        { status: 429, headers: { "Retry-After": "30" } },
      )
    }
    const user = authResult.user
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    console.log("[v0] Processing pending invites for user:", user.email)

    // Get user's email
    const userEmail = user.email
    if (!userEmail) {
      return NextResponse.json({ error: "User email not found" }, { status: 400 })
    }

    const { data: orgInvites, error: orgInvitesError } = await serviceClient
      .from("organization_invites")
      .select("id, org_id, role, invited_by")
      .eq("email", userEmail.toLowerCase())
      .eq("status", "pending")

    if (orgInvitesError) {
      console.error("[v0] Error fetching organization invites:", orgInvitesError)
    }

    const processedOrgInvites = []
    if (orgInvites && orgInvites.length > 0) {
      console.log("[v0] Found organization invites:", orgInvites.length)

      for (const invite of orgInvites) {
        // Check if already a member
        const { data: existingMember } = await serviceClient
          .from("organization_members")
          .select("id")
          .eq("org_id", invite.org_id)
          .eq("user_id", user.id)
          .maybeSingle()

        if (existingMember) {
          // Already a member, just mark invite as accepted
          await serviceClient.from("organization_invites").update({ status: "accepted" }).eq("id", invite.id)
          continue
        }

        // Create organization membership
        const { error: memberError } = await serviceClient.from("organization_members").insert({
          org_id: invite.org_id,
          user_id: user.id,
          role: invite.role,
          invited_by: invite.invited_by,
          joined_at: new Date().toISOString(),
        })

        if (memberError) {
          console.error("[v0] Error creating organization membership:", memberError)
          continue
        }

        // Mark invite as accepted
        await serviceClient.from("organization_invites").update({ status: "accepted" }).eq("id", invite.id)

        processedOrgInvites.push(invite.org_id)
      }
    }

    // Process pad invites
    const { data: padInvites, error: padInvitesError } = await supabase
      .from("paks_pad_pending_invites")
      .select("pad_id, role")
      .eq("email", userEmail)

    if (padInvitesError) {
      console.error("[v0] Error fetching pad invites:", padInvitesError)
    }

    const processedPadInvites = []
    if (padInvites && padInvites.length > 0) {
      console.log("[v0] Found pad invites:", padInvites.length)

      for (const invite of padInvites) {
        // Create pad membership
        const { error: memberError } = await supabase.from("paks_pad_members").insert({
          pad_id: invite.pad_id,
          user_id: user.id,
          role: invite.role,
          accepted: true,
          joined_at: new Date().toISOString(),
        })

        if (memberError) {
          console.error("[v0] Error creating pad membership:", memberError)
          continue
        }

        // Delete the pending invite
        const { error: deleteError } = await supabase
          .from("paks_pad_pending_invites")
          .delete()
          .eq("pad_id", invite.pad_id)
          .eq("email", userEmail)

        if (deleteError) {
          console.error("[v0] Error deleting pad invite:", deleteError)
        } else {
          processedPadInvites.push(invite.pad_id)
        }
      }
    }

    console.log("[v0] Processed invites - Orgs:", processedOrgInvites.length, "Pads:", processedPadInvites.length)

    return NextResponse.json({
      success: true,
      processedOrgInvites,
      processedPadInvites,
    })
  } catch (error) {
    console.error("[v0] Error processing invites:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

// POST /api/organizations/[orgId]/members/import - Import/pre-register members from CSV
export async function POST(request: NextRequest, { params }: { params: { orgId: string } }) {
  try {
    const supabase = await createClient()
    const serviceClient = createServiceClient()
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
    const { orgId } = params

    // Verify user is admin/owner
    const { data: membership } = await supabase
      .from("organization_members")
      .select("role")
      .eq("org_id", orgId)
      .eq("user_id", user.id)
      .maybeSingle()

    if (!membership || !["owner", "admin"].includes(membership.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Parse request body
    const body = await request.json()
    let members: { email: string; name?: string }[] = []

    if (Array.isArray(body.members)) {
      members = body.members
    } else if (Array.isArray(body.emails)) {
      // Backwards compatibility: convert emails array to members array
      members = body.emails.map((email: string) => ({ email }))
    }

    if (members.length === 0) {
      return NextResponse.json({ error: "No members provided" }, { status: 400 })
    }

    // Validate and limit
    if (members.length > 100) {
      return NextResponse.json({ error: "Maximum 100 members per import" }, { status: 400 })
    }

    const defaultRole = "viewer"

    const results = {
      preRegistered: [] as string[],
      alreadyMember: [] as string[],
      alreadyPreRegistered: [] as string[],
      errors: [] as { email: string; error: string }[],
    }

    for (const member of members) {
      const email = member.email?.trim().toLowerCase()
      // const name = member.name?.trim() || null

      if (!email || !email.includes("@")) {
        results.errors.push({ email: email || "empty", error: "Invalid email" })
        continue
      }

      try {
        // Check if user already exists and is a member
        const { data: existingUser } = (await serviceClient
          .from("users")
          .select("id")
          .eq("email", email)
          .maybeSingle()) as { data: { id: string } | null }

        if (existingUser) {
          // Check if already a member
          const { data: existingMember } = await serviceClient
            .from("organization_members")
            .select("id")
            .eq("org_id", orgId)
            .eq("user_id", existingUser.id)
            .maybeSingle()

          if (existingMember) {
            results.alreadyMember.push(email)
            continue
          }

          // User exists but not a member - add them directly
          const { error: memberError } = await (
            serviceClient.from("organization_members") as ReturnType<typeof serviceClient.from>
          ).insert({
            org_id: orgId,
            user_id: existingUser.id,
            role: defaultRole,
            status: "active",
            invited_by: user.id,
            joined_at: new Date().toISOString(),
          } as Record<string, unknown>)

          if (memberError) {
            console.error("[v0] Failed to add member:", memberError)
            results.errors.push({ email, error: "Failed to add member" })
          } else {
            results.preRegistered.push(email)
          }
          continue
        }

        // Check if already pre-registered
        const { data: existingPreReg } = await serviceClient
          .from("organization_invites")
          .select("id, status")
          .eq("org_id", orgId)
          .eq("email", email)
          .in("status", ["pre_registered", "pending"])
          .maybeSingle()

        if (existingPreReg) {
          results.alreadyPreRegistered.push(email)
          continue
        }

        const { error: inviteError } = await (
          serviceClient.from("organization_invites") as ReturnType<typeof serviceClient.from>
        ).insert({
          org_id: orgId,
          email,
          role: defaultRole,
          invited_by: user.id,
          status: "pre_registered",
          invited_at: new Date().toISOString(),
          expires_at: null,
          token: null,
        } as Record<string, unknown>)

        if (inviteError) {
          console.error("[v0] Failed to pre-register:", inviteError)
          results.errors.push({ email, error: "Failed to pre-register" })
          continue
        }

        results.preRegistered.push(email)
      } catch (err) {
        console.error("[v0] Unexpected error for email:", email, err)
        results.errors.push({ email, error: "Unexpected error" })
      }
    }

    return NextResponse.json({
      success: results.preRegistered.length,
      failed: results.errors.length,
      alreadyMember: results.alreadyMember.length,
      alreadyPreRegistered: results.alreadyPreRegistered.length,
      details: {
        preRegistered: results.preRegistered,
        alreadyMember: results.alreadyMember,
        alreadyPreRegistered: results.alreadyPreRegistered,
        errors: results.errors,
      },
    })
  } catch (err) {
    console.error("Unexpected error in POST /api/organizations/[orgId]/members/import:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

import { createServiceDatabaseClient } from "@/lib/database/database-adapter"
import { NextResponse } from "next/server"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

export async function POST(request: Request) {
  try {
    const serviceDb = await createServiceDatabaseClient()

    const authResult = await getCachedAuthUser()
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

    const { token } = await request.json()

    if (!token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 })
    }

    console.log("[v0] Processing organization invite with token for user:", user.email)

    const { data: invite, error: inviteError } = await serviceDb
      .from("organization_invites")
      .select("*, organizations(name)")
      .eq("token", token)
      .eq("status", "pending")
      .maybeSingle()

    if (inviteError || !invite) {
      console.error("[v0] Invalid or not found invite:", inviteError)
      return NextResponse.json({ error: "Invalid or expired invitation link" }, { status: 404 })
    }

    // Check if invite matches user's email
    if (invite.email.toLowerCase() !== user.email?.toLowerCase()) {
      return NextResponse.json(
        {
          error: "Email mismatch",
          code: "EMAIL_MISMATCH",
          inviteEmail: invite.email,
          userEmail: user.email,
        },
        { status: 403 },
      )
    }

    // Check if invite has expired
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      return NextResponse.json({ error: "Invitation has expired", code: "EXPIRED" }, { status: 410 })
    }

    // Check if user is already a member
    const { data: existingMember } = await serviceDb
      .from("organization_members")
      .select("id")
      .eq("org_id", invite.org_id)
      .eq("user_id", user.id)
      .maybeSingle()

    if (existingMember) {
      // Already a member - just mark invite as accepted and redirect
      await serviceDb.from("organization_invites").update({ status: "accepted" }).eq("id", invite.id)

      return NextResponse.json({
        success: true,
        orgId: invite.org_id,
        alreadyMember: true,
      })
    }

    // Add user to organization
    const { error: memberError } = await serviceDb.from("organization_members").insert({
      org_id: invite.org_id,
      user_id: user.id,
      role: invite.role,
      invited_by: invite.invited_by,
      joined_at: new Date().toISOString(),
    })

    if (memberError) {
      console.error("[v0] Error adding member:", memberError)
      return NextResponse.json({ error: "Failed to join organization" }, { status: 500 })
    }

    // Mark invite as accepted
    await serviceDb.from("organization_invites").update({ status: "accepted" }).eq("id", invite.id)

    console.log("[v0] User joined organization:", invite.org_id)

    return NextResponse.json({
      success: true,
      orgId: invite.org_id,
      organizationName: invite.organizations?.name,
    })
  } catch (error) {
    console.error("[v0] Error accepting invite:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

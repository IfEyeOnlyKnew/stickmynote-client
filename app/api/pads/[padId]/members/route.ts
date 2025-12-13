import { type NextRequest, NextResponse } from "next/server"
import { createServerClient, createServiceClient } from "@/lib/supabase/server"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from "@/lib/auth/cached-auth"

export async function GET(request: NextRequest, { params }: { params: { padId: string } }) {
  try {
    const supabase = await createServerClient()
    const supabaseAdmin = createServiceClient()

    const authResult = await getCachedAuthUser(supabase)

    if (authResult.rateLimited) {
      return createRateLimitResponse()
    }

    if (!authResult.user) {
      return createUnauthorizedResponse()
    }

    const user = authResult.user

    let orgContext
    try {
      orgContext = await getOrgContext(user.id)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      if (errorMessage === "RATE_LIMITED") {
        return createRateLimitResponse()
      }
      throw err
    }

    if (!orgContext) {
      return NextResponse.json({ error: "No organization context" }, { status: 403 })
    }

    const { padId } = params

    const { data: pad, error: padError } = await supabaseAdmin
      .from("paks_pads")
      .select("name, owner_id, org_id, users!paks_pads_owner_id_fkey(id, email, username, full_name)")
      .eq("id", padId)
      .eq("org_id", orgContext.orgId)
      .maybeSingle()

    if (padError || !pad) {
      return NextResponse.json({ error: "Pad not found" }, { status: 404 })
    }

    const { data: members, error: membersError } = await supabaseAdmin
      .from("paks_pad_members")
      .select("user_id, role, org_id, users!paks_pad_members_user_id_fkey(id, email, username, full_name)")
      .eq("pad_id", padId)
      .eq("org_id", orgContext.orgId)

    if (membersError) {
      return NextResponse.json({ error: "Failed to fetch members" }, { status: 500 })
    }

    const formattedMembers = []

    const ownerUser = Array.isArray(pad.users) ? pad.users[0] : pad.users
    if (ownerUser) {
      formattedMembers.push({
        id: ownerUser.id,
        email: ownerUser.email,
        username: ownerUser.username,
        full_name: ownerUser.full_name,
        role: "owner",
      })
    }

    if (members && members.length > 0) {
      for (const member of members) {
        const memberUser = Array.isArray(member.users) ? member.users[0] : member.users
        if (memberUser && memberUser.id !== pad.owner_id) {
          formattedMembers.push({
            id: memberUser.id,
            email: memberUser.email,
            username: memberUser.username,
            full_name: memberUser.full_name,
            role: member.role,
          })
        }
      }
    }

    return NextResponse.json({
      padName: pad.name,
      members: formattedMembers,
    })
  } catch (error) {
    console.error("Error in pad members API:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { padId: string } }) {
  try {
    const supabase = await createServerClient()
    const { padId } = params

    const authResult = await getCachedAuthUser(supabase)

    if (authResult.rateLimited) {
      return createRateLimitResponse()
    }

    if (!authResult.user) {
      return createUnauthorizedResponse()
    }

    const user = authResult.user

    let orgContext
    try {
      orgContext = await getOrgContext(user.id)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      if (errorMessage === "RATE_LIMITED") {
        return createRateLimitResponse()
      }
      throw err
    }

    if (!orgContext) {
      return NextResponse.json({ error: "No organization context" }, { status: 403 })
    }

    const url = new URL(request.url)
    const userIdToRemove = url.searchParams.get("userId")

    if (!userIdToRemove) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 })
    }

    const { data: pad } = await supabase
      .from("paks_pads")
      .select("owner_id, org_id")
      .eq("id", padId)
      .eq("org_id", orgContext.orgId)
      .maybeSingle()

    if (!pad) {
      return NextResponse.json({ error: "Pad not found" }, { status: 404 })
    }

    const isPadOwner = pad.owner_id === user.id

    if (!isPadOwner) {
      return NextResponse.json({ error: "Only pad owners can remove members" }, { status: 403 })
    }

    const { error: deleteError } = await supabase
      .from("paks_pad_members")
      .delete()
      .eq("pad_id", padId)
      .eq("user_id", userIdToRemove)
      .eq("org_id", orgContext.orgId)

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error removing pad member:", error)
    return NextResponse.json({ error: "Failed to remove member" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { padId: string } }) {
  try {
    const supabase = await createServerClient()
    const { padId } = params

    const authResult = await getCachedAuthUser(supabase)

    if (authResult.rateLimited) {
      return createRateLimitResponse()
    }

    if (!authResult.user) {
      return createUnauthorizedResponse()
    }

    const user = authResult.user

    let orgContext
    try {
      orgContext = await getOrgContext(user.id)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      if (errorMessage === "RATE_LIMITED") {
        return createRateLimitResponse()
      }
      throw err
    }

    if (!orgContext) {
      return NextResponse.json({ error: "No organization context" }, { status: 403 })
    }

    const { userId, role } = await request.json()

    if (!userId || !role) {
      return NextResponse.json({ error: "Missing userId or role" }, { status: 400 })
    }

    const { data: pad } = await supabase
      .from("paks_pads")
      .select("owner_id, org_id")
      .eq("id", padId)
      .eq("org_id", orgContext.orgId)
      .maybeSingle()

    if (!pad) {
      return NextResponse.json({ error: "Pad not found" }, { status: 404 })
    }

    const isPadOwner = pad.owner_id === user.id

    if (!isPadOwner) {
      const { data: memberCheck } = await supabase
        .from("paks_pad_members")
        .select("role")
        .eq("pad_id", padId)
        .eq("user_id", user.id)
        .eq("org_id", orgContext.orgId)
        .maybeSingle()

      if (!memberCheck || memberCheck.role !== "admin") {
        return NextResponse.json({ error: "Only owners and admins can update member roles" }, { status: 403 })
      }
    }

    const { error: updateError } = await supabase
      .from("paks_pad_members")
      .update({ role })
      .eq("pad_id", padId)
      .eq("user_id", userId)
      .eq("org_id", orgContext.orgId)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error updating pad member role:", error)
    return NextResponse.json({ error: "Failed to update member role" }, { status: 500 })
  }
}

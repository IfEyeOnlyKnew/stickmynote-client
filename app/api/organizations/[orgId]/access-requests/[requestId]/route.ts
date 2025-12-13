import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

interface OrganizationMemberInsert {
  org_id: string
  user_id: string
  role: string
  status: string
  approved_by: string
  approved_at: string
  joined_at: string
}

interface AccessRequestUpdate {
  status: string
  reviewed_by: string
  reviewed_at: string
  rejection_reason?: string
  updated_at: string
}

// PATCH /api/organizations/[orgId]/access-requests/[requestId] - Approve/Reject request
export async function PATCH(request: NextRequest, { params }: { params: { orgId: string; requestId: string } }) {
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
    const { orgId, requestId } = params
    const body = await request.json()
    const { action, role = "member", rejection_reason } = body

    if (!["approve", "reject"].includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }

    // Verify user is admin/owner of this organization
    const { data: membership } = await supabase
      .from("organization_members")
      .select("role")
      .eq("org_id", orgId)
      .eq("user_id", user.id)
      .maybeSingle()

    if (!membership || !["owner", "admin"].includes(membership.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Get the access request
    const { data: accessRequest, error: fetchError } = await supabase
      .from("organization_access_requests")
      .select("*")
      .eq("id", requestId)
      .eq("org_id", orgId)
      .maybeSingle()

    if (fetchError || !accessRequest) {
      return NextResponse.json({ error: "Access request not found" }, { status: 404 })
    }

    if (accessRequest.status !== "pending") {
      return NextResponse.json({ error: "This request has already been processed" }, { status: 400 })
    }

    if (action === "approve") {
      const memberData: OrganizationMemberInsert = {
        org_id: orgId,
        user_id: accessRequest.user_id,
        role: role,
        status: "active",
        approved_by: user.id,
        approved_at: new Date().toISOString(),
        joined_at: new Date().toISOString(),
      }

      const { error: memberError } = await (serviceClient.from("organization_members") as any).insert(memberData)

      if (memberError) {
        console.error("Error adding member:", memberError)
        return NextResponse.json({ error: "Failed to add member" }, { status: 500 })
      }

      const approveUpdate: AccessRequestUpdate = {
        status: "approved",
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      await (serviceClient.from("organization_access_requests") as any).update(approveUpdate).eq("id", requestId)

      return NextResponse.json({ success: true, message: "Access request approved" })
    } else {
      const rejectUpdate: AccessRequestUpdate = {
        status: "rejected",
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        rejection_reason: rejection_reason,
        updated_at: new Date().toISOString(),
      }

      await (serviceClient.from("organization_access_requests") as any).update(rejectUpdate).eq("id", requestId)

      return NextResponse.json({ success: true, message: "Access request rejected" })
    }
  } catch (err) {
    console.error("Unexpected error in PATCH /api/organizations/[orgId]/access-requests/[requestId]:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

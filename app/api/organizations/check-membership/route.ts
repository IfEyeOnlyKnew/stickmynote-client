import { getCachedAuthUser } from "@/lib/auth/cached-auth"
import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// GET /api/organizations/check-membership?domain=magna.com
// Check if user has active membership in organization by domain
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
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
    const domain = request.nextUrl.searchParams.get("domain")

    if (!domain) {
      return NextResponse.json({ error: "Domain required" }, { status: 400 })
    }

    const { data: orgDomain } = await supabase
      .from("organization_domains")
      .select(`
        org_id,
        domain,
        is_primary,
        is_verified,
        organizations!inner (
          id,
          name,
          require_membership_approval,
          support_contact_1_email,
          support_contact_1_name,
          support_contact_2_email,
          support_contact_2_name
        )
      `)
      .eq("domain", domain.toLowerCase())
      .maybeSingle()

    if (!orgDomain || !orgDomain.organizations) {
      return NextResponse.json({
        hasOrganization: false,
        isMember: false,
        message: "No organization found for this domain",
      })
    }

    const orgsData = orgDomain.organizations as unknown
    const org = (Array.isArray(orgsData) ? orgsData[0] : orgsData) as {
      id: string
      name: string
      require_membership_approval?: boolean
      support_contact_1_email?: string
      support_contact_1_name?: string
      support_contact_2_email?: string
      support_contact_2_name?: string
    }

    // Check membership
    const { data: membership } = await supabase
      .from("organization_members")
      .select("id, role, status")
      .eq("org_id", org.id)
      .eq("user_id", user.id)
      .maybeSingle()

    // Check pending access request
    const { data: pendingRequest } = await supabase
      .from("organization_access_requests")
      .select("id, status, created_at")
      .eq("org_id", org.id)
      .eq("user_id", user.id)
      .eq("status", "pending")
      .maybeSingle()

    if (membership) {
      return NextResponse.json({
        hasOrganization: true,
        isMember:
          (membership as { status?: string }).status === "active" || !(membership as { status?: string }).status,
        membershipStatus: (membership as { status?: string }).status || "active",
        role: membership.role,
        organization: {
          id: org.id,
          name: org.name,
        },
      })
    }

    return NextResponse.json({
      hasOrganization: true,
      isMember: false,
      hasPendingRequest: !!pendingRequest,
      pendingRequestDate: pendingRequest?.created_at,
      requiresApproval: org.require_membership_approval,
      organization: {
        id: org.id,
        name: org.name,
      },
      supportContacts: {
        contact1: {
          email: org.support_contact_1_email,
          name: org.support_contact_1_name,
        },
        contact2: {
          email: org.support_contact_2_email,
          name: org.support_contact_2_name,
        },
      },
    })
  } catch (err) {
    console.error("Unexpected error in GET /api/organizations/check-membership:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

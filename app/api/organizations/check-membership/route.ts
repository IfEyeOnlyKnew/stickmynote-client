import { getSession } from "@/lib/auth/local-auth"
import { type NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/database/pg-client"

// GET /api/organizations/check-membership?domain=magna.com
// Check if user has active membership in organization by domain
// This endpoint is public for domain checks during signin
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    const domain = request.nextUrl.searchParams.get("domain")

    if (!domain) {
      return NextResponse.json({ error: "Domain required" }, { status: 400 })
    }

    // Get organization domain with organization details
    const orgDomainResult = await db.query(
      `SELECT 
        od.org_id,
        od.domain,
        od.is_primary,
        od.is_verified,
        o.id,
        o.name,
        o.require_membership_approval,
        o.support_contact_1_email,
        o.support_contact_1_name,
        o.support_contact_2_email,
        o.support_contact_2_name
      FROM organization_domains od
      INNER JOIN organizations o ON o.id = od.org_id
      WHERE od.domain = $1
      LIMIT 1`,
      [domain.toLowerCase()]
    )

    if (orgDomainResult.rows.length === 0) {
      return NextResponse.json({
        hasOrganization: false,
        isMember: false,
        message: "No organization found for this domain",
      })
    }

    const orgData = orgDomainResult.rows[0]
    const org = {
      id: orgData.id,
      name: orgData.name,
      require_membership_approval: orgData.require_membership_approval,
      support_contact_1_email: orgData.support_contact_1_email,
      support_contact_1_name: orgData.support_contact_1_name,
      support_contact_2_email: orgData.support_contact_2_email,
      support_contact_2_name: orgData.support_contact_2_name,
    }

    // If no user session, just return organization info without membership details
    if (!session) {
      return NextResponse.json({
        hasOrganization: true,
        isMember: false,
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
    }

    const user = session.user

    // Check membership
    const membershipResult = await db.query(
      `SELECT id, role, status
       FROM organization_members
       WHERE org_id = $1 AND user_id = $2
       LIMIT 1`,
      [org.id, user.id]
    )

    const membership = membershipResult.rows[0] || null

    // Check pending access request
    const pendingRequestResult = await db.query(
      `SELECT id, status, created_at
       FROM organization_access_requests
       WHERE org_id = $1 AND user_id = $2 AND status = 'pending'
       LIMIT 1`,
      [org.id, user.id]
    )

    const pendingRequest = pendingRequestResult.rows[0] || null

    if (membership) {
      return NextResponse.json({
        hasOrganization: true,
        isMember: membership.status === "active" || !membership.status,
        membershipStatus: membership.status || "active",
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

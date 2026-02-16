import { type NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth/local-auth"
import { testOIDCDiscovery } from "@/lib/auth/oidc-client"
import { db } from "@/lib/database/pg-client"

export const dynamic = "force-dynamic"

/**
 * POST /api/organizations/[orgId]/sso/test
 * Test SSO configuration by attempting OIDC discovery.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { orgId } = await params

    // Verify owner
    const memberResult = await db.query(
      `SELECT role FROM organization_members
       WHERE user_id = $1 AND org_id = $2 AND status = 'active'
       LIMIT 1`,
      [session.user.id, orgId],
    )

    if (memberResult.rows.length === 0 || memberResult.rows[0].role !== "owner") {
      return NextResponse.json({ error: "Only organization owners can test SSO" }, { status: 403 })
    }

    const body = await request.json()
    const { discoveryUrl, clientId, clientSecretEncrypted } = body

    if (!discoveryUrl || !clientId || !clientSecretEncrypted) {
      return NextResponse.json(
        { error: "Discovery URL, Client ID, and encrypted Client Secret are required" },
        { status: 400 },
      )
    }

    const result = await testOIDCDiscovery(discoveryUrl, clientId, clientSecretEncrypted, orgId)

    return NextResponse.json(result)
  } catch (error) {
    console.error("[SSO Test] Error:", error)
    return NextResponse.json(
      { success: false, error: "Test failed unexpectedly" },
      { status: 500 },
    )
  }
}

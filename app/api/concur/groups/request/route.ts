import { createDatabaseClient, createServiceDatabaseClient } from "@/lib/database/database-adapter"
import { NextResponse } from "next/server"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from "@/lib/auth/cached-auth"
import { publishToUsers } from "@/lib/ws/publish-event"

const LOG_PREFIX = "[ConcurGroupRequest]"

const Errors = {
  rateLimit: () => createRateLimitResponse(),
  unauthorized: () => createUnauthorizedResponse(),
  noOrgContext: () => NextResponse.json({ error: "No organization context" }, { status: 403 }),
  missingFields: () => NextResponse.json({ error: "Group name, owner1Email, and owner2Email are required" }, { status: 400 }),
  submitFailed: () => NextResponse.json({ error: "Failed to submit group request" }, { status: 500 }),
}

async function getAuthenticatedOrgContext() {
  const { user, error: authError } = await getCachedAuthUser()
  if (authError === "rate_limited") return { error: "RATE_LIMITED" as const }
  if (!user) return { error: "UNAUTHORIZED" as const }

  const orgContext = await getOrgContext()
  if (!orgContext) return { error: "NO_ORG" as const }

  return { user, orgContext }
}

function handleAuthError(error: string | undefined): NextResponse {
  if (error === "RATE_LIMITED") return Errors.rateLimit()
  if (error === "UNAUTHORIZED") return Errors.unauthorized()
  return Errors.noOrgContext()
}

async function getConcurAdminRecipients(orgId: string): Promise<string[]> {
  const db = await createDatabaseClient()
  const recipients = new Set<string>()

  const { data: admins } = await db
    .from("concur_administrators")
    .select("user_id")
    .eq("org_id", orgId)

  for (const a of admins || []) recipients.add(a.user_id)

  const { data: owners } = await db
    .from("organization_members")
    .select("user_id")
    .eq("org_id", orgId)
    .eq("role", "owner")

  for (const o of owners || []) recipients.add(o.user_id)

  return Array.from(recipients)
}

export async function POST(request: Request) {
  try {
    const authResult = await getAuthenticatedOrgContext()
    if ("error" in authResult) return handleAuthError(authResult.error)

    const { user, orgContext } = authResult

    const { name, description, owner1Email, owner2Email } = await request.json()
    if (!name?.trim() || !owner1Email?.trim() || !owner2Email?.trim()) {
      return Errors.missingFields()
    }

    const serviceDb = await createServiceDatabaseClient()
    const { data: requester } = await serviceDb
      .from("users")
      .select("full_name, email")
      .eq("id", user.id)
      .maybeSingle()

    const payload = {
      requestedBy: user.id,
      requesterName: requester?.full_name || requester?.email || user.email || "Unknown",
      requesterEmail: requester?.email || user.email || "",
      name: name.trim(),
      description: description?.trim() || null,
      owner1Email: owner1Email.trim(),
      owner2Email: owner2Email.trim(),
    }

    console.log(`${LOG_PREFIX} Group request from ${payload.requesterEmail}:`, payload)

    const recipientIds = await getConcurAdminRecipients(orgContext.orgId)
    if (recipientIds.length > 0) {
      publishToUsers(recipientIds, {
        type: "concur.group_requested",
        payload,
        timestamp: Date.now(),
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(`${LOG_PREFIX} POST error:`, error)
    return Errors.submitFailed()
  }
}

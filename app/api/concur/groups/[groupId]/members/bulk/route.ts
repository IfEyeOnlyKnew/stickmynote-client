import { createDatabaseClient, createServiceDatabaseClient } from "@/lib/database/database-adapter"
import { NextResponse } from "next/server"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from "@/lib/auth/cached-auth"

// ============================================================================
// Constants & Errors
// ============================================================================

const LOG_PREFIX = "[ConcurBulkMembers]"

// ============================================================================
// POST - Bulk import members from CSV data (owners only)
// ============================================================================

async function processBulkMember(
  db: any, serviceDb: any, email: string, groupId: string, orgId: string, addedBy: string,
  results: { added: number; skipped: number; notFound: string[]; errors: string[] },
): Promise<void> {
  try {
    const { data: targetUser } = await serviceDb.from("users").select("id").eq("email", email).maybeSingle()
    if (!targetUser) { results.notFound.push(email); return }

    const { data: orgMember } = await db.from("organization_members").select("id").eq("org_id", orgId).eq("user_id", targetUser.id).maybeSingle()
    if (!orgMember) { results.notFound.push(email); return }

    const { data: existing } = await db.from("concur_group_members").select("id").eq("group_id", groupId).eq("user_id", targetUser.id).maybeSingle()
    if (existing) { results.skipped++; return }

    const { error: insertError } = await db.from("concur_group_members").insert({
      group_id: groupId, user_id: targetUser.id, org_id: orgId, role: "member", added_by: addedBy,
    })

    if (insertError) { results.errors.push(`Failed to add ${email}: ${insertError.message}`) }
    else { results.added++ }
  } catch {
    results.errors.push(`Error processing ${email}`)
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ groupId: string }> }) {
  try {
    const { groupId } = await params

    const { user, error: authError } = await getCachedAuthUser()
    if (authError === "rate_limited") return createRateLimitResponse()
    if (!user) return createUnauthorizedResponse()

    const orgContext = await getOrgContext()
    if (!orgContext) return NextResponse.json({ error: "No organization context" }, { status: 403 })

    const db = await createDatabaseClient()
    const serviceDb = await createServiceDatabaseClient()

    // Check caller is owner
    const { data: membership } = await db
      .from("concur_group_members")
      .select("role")
      .eq("group_id", groupId)
      .eq("user_id", user.id)
      .eq("org_id", orgContext.orgId)
      .maybeSingle()

    if (membership?.role !== "owner") {
      return NextResponse.json({ error: "Only group owners can bulk import members" }, { status: 403 })
    }

    const { members } = await request.json()

    if (!Array.isArray(members) || members.length === 0) {
      return NextResponse.json({ error: "Members array is required" }, { status: 400 })
    }

    const results = {
      added: 0,
      skipped: 0,
      notFound: [] as string[],
      errors: [] as string[],
    }

    for (const entry of members) {
      const email = (entry.email || entry)?.toString().trim().toLowerCase()
      if (!email?.includes("@")) {
        results.errors.push(`Invalid email: ${email}`)
        continue
      }

      await processBulkMember(db, serviceDb, email, groupId, orgContext.orgId, user.id, results)
    }

    return NextResponse.json({
      success: true,
      results,
    })
  } catch (error) {
    console.error(`${LOG_PREFIX} POST error:`, error)
    return NextResponse.json({ error: "Failed to bulk import members" }, { status: 500 })
  }
}

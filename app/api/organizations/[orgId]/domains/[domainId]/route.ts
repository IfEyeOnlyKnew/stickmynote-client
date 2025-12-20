import { getCachedAuthUser } from "@/lib/auth/cached-auth"
import { createDatabaseClient } from "@/lib/database/database-adapter"
import { type NextRequest, NextResponse } from "next/server"

interface RouteContext {
  params: Promise<{ orgId: string; domainId: string }>
}

// PATCH - Update domain (set primary, verify)
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { orgId, domainId } = await context.params
    const db = await createDatabaseClient()

    const authResult = await getCachedAuthUser()

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

    // Check permissions
    const { data: org } = await db
      .from("organizations")
      .select("owner_id, metadata")
      .eq("id", orgId)
      .maybeSingle()

    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 })
    }

    const { data: userProfile } = await db.from("users").select("email").eq("id", user.id).maybeSingle()

    const isOwner = org.owner_id === user.id
    const metadata = org.metadata as Record<string, string> | null
    const isContact =
      metadata?.primary_contact_email === userProfile?.email || metadata?.secondary_contact_email === userProfile?.email

    if (!isOwner && !isContact) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 })
    }

    const body = await request.json()
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

    if (typeof body.is_primary === "boolean") {
      updates.is_primary = body.is_primary
    }

    if (typeof body.is_verified === "boolean") {
      updates.is_verified = body.is_verified
      if (body.is_verified) {
        updates.verified_at = new Date().toISOString()
        updates.verified_by = user.id
      }
    }

    const { data: domain, error } = await db
      .from("organization_domains")
      .update(updates)
      .eq("id", domainId)
      .eq("org_id", orgId)
      .select()
      .maybeSingle()

    if (error) {
      console.error("Error updating domain:", error)
      return NextResponse.json({ error: "Failed to update domain" }, { status: 500 })
    }

    return NextResponse.json({ domain })
  } catch (error) {
    console.error("Error in domains PATCH:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE - Remove domain
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { orgId, domainId } = await context.params
    const db = await createDatabaseClient()

    const authResult = await getCachedAuthUser()

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

    // Check permissions
    const { data: org } = await db
      .from("organizations")
      .select("owner_id, metadata")
      .eq("id", orgId)
      .maybeSingle()

    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 })
    }

    const { data: userProfile } = await db.from("users").select("email").eq("id", user.id).maybeSingle()

    const isOwner = org.owner_id === user.id
    const metadata = org.metadata as Record<string, string> | null
    const isContact =
      metadata?.primary_contact_email === userProfile?.email || metadata?.secondary_contact_email === userProfile?.email

    if (!isOwner && !isContact) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 })
    }

    // Check if this is the last domain
    const { count } = await db
      .from("organization_domains")
      .select("*", { count: "exact", head: true })
      .eq("org_id", orgId)

    if (count && count <= 1) {
      return NextResponse.json({ error: "Cannot remove the last domain" }, { status: 400 })
    }

    const { error: deleteError } = await db
      .from("organization_domains")
      .delete()
      .eq("id", domainId)
      .eq("org_id", orgId)

    if (deleteError) {
      console.error("Error deleting domain:", deleteError)
      return NextResponse.json({ error: "Failed to delete domain" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error in domains DELETE:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

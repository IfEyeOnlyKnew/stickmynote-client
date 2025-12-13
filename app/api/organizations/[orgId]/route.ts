import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/server"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isValidUUID(str: string): boolean {
  return UUID_REGEX.test(str)
}

// GET /api/organizations/[orgId] - Get organization details
export async function GET(req: Request, { params }: { params: { orgId: string } }) {
  try {
    const { orgId } = params

    if (!isValidUUID(orgId)) {
      return NextResponse.json({ error: "Invalid organization ID" }, { status: 400 })
    }

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

    const serviceClient = createServiceClient()

    // Check membership
    const { data: membership, error: memberError } = await serviceClient
      .from("organization_members")
      .select("role")
      .eq("org_id", orgId)
      .eq("user_id", user.id)
      .maybeSingle()

    if (memberError || !membership) {
      return NextResponse.json({ error: "Not a member of this organization" }, { status: 403 })
    }

    // Get organization
    const { data: org, error: orgError } = await serviceClient
      .from("organizations")
      .select("*")
      .eq("id", orgId)
      .maybeSingle()

    if (orgError || !org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 })
    }

    return NextResponse.json({ organization: org, role: membership.role })
  } catch (err) {
    console.error("[v0] Unexpected error in GET /api/organizations/[orgId]:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PATCH /api/organizations/[orgId] - Update organization
export async function PATCH(req: Request, { params }: { params: { orgId: string } }) {
  try {
    const { orgId } = params

    if (!isValidUUID(orgId)) {
      return NextResponse.json({ error: "Invalid organization ID" }, { status: 400 })
    }

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

    const serviceClient = createServiceClient()

    // Check admin/owner role
    const { data: membership, error: memberError } = await serviceClient
      .from("organization_members")
      .select("role")
      .eq("org_id", orgId)
      .eq("user_id", user.id)
      .maybeSingle()

    if (memberError || !membership) {
      return NextResponse.json({ error: "Not a member of this organization" }, { status: 403 })
    }

    if (membership.role !== "owner" && membership.role !== "admin") {
      return NextResponse.json({ error: "Only owners and admins can update organization" }, { status: 403 })
    }

    const body = await req.json()
    const {
      name,
      settings,
      ai_sessions_per_day,
      require_preregistration,
      max_failed_attempts,
      lockout_duration_minutes,
    } = body

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (name && typeof name === "string") updates.name = name.trim()
    if (settings && typeof settings === "object") updates.settings = settings
    if (typeof ai_sessions_per_day === "number" && ai_sessions_per_day >= 0 && ai_sessions_per_day <= 100) {
      updates.ai_sessions_per_day = ai_sessions_per_day
    }
    if (typeof require_preregistration === "boolean") {
      updates.require_preregistration = require_preregistration
    }
    if (typeof max_failed_attempts === "number" && max_failed_attempts >= 1 && max_failed_attempts <= 20) {
      updates.max_failed_attempts = max_failed_attempts
    }
    if (
      typeof lockout_duration_minutes === "number" &&
      lockout_duration_minutes >= 1 &&
      lockout_duration_minutes <= 1440
    ) {
      updates.lockout_duration_minutes = lockout_duration_minutes
    }

    const { data: updated, error: updateError } = await serviceClient
      .from("organizations")
      .update(updates)
      .eq("id", orgId)
      .select()
      .maybeSingle()

    if (updateError) {
      console.error("[v0] Error updating organization:", updateError)
      return NextResponse.json({ error: "Failed to update organization" }, { status: 500 })
    }

    return NextResponse.json({ organization: updated })
  } catch (err) {
    console.error("[v0] Unexpected error in PATCH /api/organizations/[orgId]:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE /api/organizations/[orgId] - Delete organization
export async function DELETE(req: Request, { params }: { params: { orgId: string } }) {
  try {
    const { orgId } = params

    if (!isValidUUID(orgId)) {
      return NextResponse.json({ error: "Invalid organization ID" }, { status: 400 })
    }

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

    const serviceClient = createServiceClient()

    // Check owner role
    const { data: membership, error: memberError } = await serviceClient
      .from("organization_members")
      .select("role")
      .eq("org_id", orgId)
      .eq("user_id", user.id)
      .maybeSingle()

    if (memberError || !membership) {
      return NextResponse.json({ error: "Not a member of this organization" }, { status: 403 })
    }

    if (membership.role !== "owner") {
      return NextResponse.json({ error: "Only owners can delete organization" }, { status: 403 })
    }

    // Check if it's a personal org
    const { data: org, error: orgError } = await serviceClient
      .from("organizations")
      .select("type")
      .eq("id", orgId)
      .maybeSingle()

    if (orgError || !org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 })
    }

    if (org.type === "personal") {
      return NextResponse.json({ error: "Cannot delete personal organization" }, { status: 400 })
    }

    // Delete organization (cascade will handle members)
    const { error: deleteError } = await serviceClient.from("organizations").delete().eq("id", orgId)

    if (deleteError) {
      console.error("[v0] Error deleting organization:", deleteError)
      return NextResponse.json({ error: "Failed to delete organization" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[v0] Unexpected error in DELETE /api/organizations/[orgId]:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

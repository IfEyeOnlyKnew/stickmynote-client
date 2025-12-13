import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/server"
import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from "@/lib/auth/cached-auth"

// GET /api/organizations - Get all organizations for current user
export async function GET() {
  try {
    const supabase = await createClient()
    const authResult = await getCachedAuthUser(supabase)

    if (authResult.rateLimited) {
      return createRateLimitResponse()
    }

    if (!authResult.user) {
      return createUnauthorizedResponse()
    }

    const user = authResult.user

    const serviceClient = createServiceClient()

    const { data: memberships, error } = await serviceClient
      .from("organization_members")
      .select(`
        id,
        org_id,
        role,
        accepted_at,
        created_at,
        organizations (
          id,
          name,
          slug,
          type,
          settings,
          created_at,
          updated_at
        )
      `)
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })

    if (error) {
      console.error("[v0] Error fetching organizations:", error)
      return NextResponse.json({ error: "Failed to fetch organizations" }, { status: 500 })
    }

    return NextResponse.json({ memberships })
  } catch (err) {
    console.error("[v0] Unexpected error in GET /api/organizations:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST /api/organizations - Create a new organization
export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const authResult = await getCachedAuthUser(supabase)

    if (authResult.rateLimited) {
      return createRateLimitResponse()
    }

    if (!authResult.user) {
      return createUnauthorizedResponse()
    }

    const user = authResult.user

    const body = await req.json()
    const { name, type = "team" } = body

    if (!name || typeof name !== "string" || name.trim().length < 2) {
      return NextResponse.json({ error: "Organization name must be at least 2 characters" }, { status: 400 })
    }

    if (type !== "team" && type !== "enterprise") {
      return NextResponse.json({ error: "Invalid organization type" }, { status: 400 })
    }

    const serviceClient = createServiceClient()

    // Generate unique slug
    const baseSlug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
    const slug = `${baseSlug}-${Math.random().toString(36).substring(2, 7)}`

    // Create organization
    const { data: newOrg, error: createError } = await serviceClient
      .from("organizations")
      .insert({
        name: name.trim(),
        slug,
        type,
        settings: {},
      })
      .select()
      .single()

    if (createError) {
      console.error("[v0] Error creating organization:", createError)
      return NextResponse.json({ error: "Failed to create organization" }, { status: 500 })
    }

    // Add creator as owner
    const { error: memberError } = await serviceClient.from("organization_members").insert({
      org_id: newOrg.id,
      user_id: user.id,
      role: "owner",
      accepted_at: new Date().toISOString(),
    })

    if (memberError) {
      console.error("[v0] Error adding owner:", memberError)
      // Clean up org
      await serviceClient.from("organizations").delete().eq("id", newOrg.id)
      return NextResponse.json({ error: "Failed to create organization" }, { status: 500 })
    }

    return NextResponse.json({ organization: newOrg }, { status: 201 })
  } catch (err) {
    console.error("[v0] Unexpected error in POST /api/organizations:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

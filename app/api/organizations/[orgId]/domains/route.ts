import { getCachedAuthUser } from "@/lib/auth/cached-auth"
import { createDatabaseClient } from "@/lib/database/database-adapter"
import { type NextRequest, NextResponse } from "next/server"

interface RouteContext {
  params: Promise<{ orgId: string }>
}

// GET - List all domains for an organization
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { orgId } = await context.params
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

    // Check if user has access to this organization
    const { data: membership } = await db
      .from("organization_members")
      .select("role")
      .eq("org_id", orgId)
      .eq("user_id", user.id)
      .maybeSingle()

    const { data: org } = await db.from("organizations").select("owner_id").eq("id", orgId).maybeSingle()

    if (!membership && org?.owner_id !== user.id) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Fetch domains
    const { data: domains, error } = await db
      .from("organization_domains")
      .select("*")
      .eq("org_id", orgId)
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: true })

    if (error) {
      console.error("Error fetching domains:", error)
      return NextResponse.json({ error: "Failed to fetch domains" }, { status: 500 })
    }

    return NextResponse.json({ domains: domains || [] })
  } catch (error) {
    console.error("Error in domains GET:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST - Add a new domain
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { orgId } = await context.params
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

    // Check if user is owner or contact
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
      return NextResponse.json({ error: "Only owner or contacts can add domains" }, { status: 403 })
    }

    const body = await request.json()
    const { domain, is_primary } = body

    if (!domain) {
      return NextResponse.json({ error: "Domain is required" }, { status: 400 })
    }

    // Normalize domain (lowercase, trim)
    const normalizedDomain = domain.toLowerCase().trim()

    // Validate domain format
    const domainRegex = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/
    if (!domainRegex.test(normalizedDomain)) {
      return NextResponse.json({ error: "Invalid domain format" }, { status: 400 })
    }

    // Check if domain already exists
    const { data: existingDomain } = await db
      .from("organization_domains")
      .select("id, org_id")
      .eq("domain", normalizedDomain)
      .single()

    if (existingDomain) {
      if (existingDomain.org_id === orgId) {
        return NextResponse.json({ error: "Domain already added to this organization" }, { status: 400 })
      } else {
        return NextResponse.json({ error: "Domain is already claimed by another organization" }, { status: 400 })
      }
    }

    // Insert new domain
    const { data: newDomain, error } = await db
      .from("organization_domains")
      .insert({
        org_id: orgId,
        domain: normalizedDomain,
        is_primary: is_primary || false,
        is_verified: false,
        created_by: user.id,
      })
      .select()
      .single()

    if (error) {
      console.error("Error adding domain:", error)
      return NextResponse.json({ error: "Failed to add domain" }, { status: 500 })
    }

    return NextResponse.json({ domain: newDomain })
  } catch (error) {
    console.error("Error in domains POST:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

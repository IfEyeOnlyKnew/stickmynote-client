import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/server"
import { extractDomain, generateOrgNameFromDomain, isPublicEmailDomain } from "@/lib/utils/email-domain"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

// POST /api/organizations/find-or-create-by-domain
export async function POST(req: Request) {
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

    const body = await req.json()
    const { email } = body

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 })
    }

    const domain = extractDomain(email)

    if (!domain) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 })
    }

    // Check if this is a public email domain
    if (isPublicEmailDomain(domain)) {
      return NextResponse.json(
        {
          error: "Public email domains not allowed",
          message: "Please use your company email address to join your organization",
          isPublic: true,
        },
        { status: 400 },
      )
    }

    const serviceClient = createServiceClient()

    const { data: existingOrgDomain, error: findError } = await serviceClient
      .from("organization_domains")
      .select(`
        org_id,
        domain,
        organizations!inner (*)
      `)
      .eq("domain", domain.toLowerCase())
      .maybeSingle()

    if (findError) {
      console.error("Error finding organization by domain:", findError)
      return NextResponse.json({ error: "Database error" }, { status: 500 })
    }

    if (existingOrgDomain && existingOrgDomain.organizations) {
      const orgData = existingOrgDomain.organizations as unknown
      const existingOrg = (Array.isArray(orgData) ? orgData[0] : orgData) as Record<string, unknown>

      // Organization exists - check if user is already a member
      const { data: existingMember } = await serviceClient
        .from("organization_members")
        .select("*")
        .eq("org_id", existingOrg.id as string)
        .eq("user_id", user.id)
        .maybeSingle()

      if (existingMember) {
        // User is already a member
        return NextResponse.json({
          organization: existingOrg,
          membership: existingMember,
          isNewMember: false,
        })
      }

      // Add user as member
      const { data: newMember, error: memberError } = await serviceClient
        .from("organization_members")
        .insert({
          org_id: existingOrg.id as string,
          user_id: user.id,
          role: "member",
          joined_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (memberError) {
        console.error("Error adding member to existing org:", memberError)
        return NextResponse.json({ error: "Failed to join organization" }, { status: 500 })
      }

      return NextResponse.json({
        organization: existingOrg,
        membership: newMember,
        isNewMember: true,
      })
    }

    // Organization doesn't exist - create new one
    const orgName = generateOrgNameFromDomain(domain)
    const slug = `${domain.replace(/\./g, "-")}-${Math.random().toString(36).substring(2, 7)}`

    const { data: newOrg, error: createError } = await serviceClient
      .from("organizations")
      .insert({
        name: orgName,
        slug,
        type: "team",
        owner_id: user.id,
        settings: {},
      })
      .select()
      .single()

    if (createError) {
      console.error("Error creating organization:", createError)
      return NextResponse.json({ error: "Failed to create organization" }, { status: 500 })
    }

    const { error: domainError } = await serviceClient.from("organization_domains").insert({
      org_id: newOrg.id,
      domain: domain.toLowerCase(),
      is_primary: true,
      is_verified: true, // Auto-verify since creator's email has this domain
      created_by: user.id,
      verified_by: user.id,
      verified_at: new Date().toISOString(),
    })

    if (domainError) {
      console.error("Error adding domain to organization:", domainError)
      // Clean up
      await serviceClient.from("organizations").delete().eq("id", newOrg.id)
      return NextResponse.json({ error: "Failed to create organization" }, { status: 500 })
    }

    // Add creator as owner
    const { data: ownerMember, error: ownerError } = await serviceClient
      .from("organization_members")
      .insert({
        org_id: newOrg.id,
        user_id: user.id,
        role: "owner",
        joined_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (ownerError) {
      console.error("Error adding owner to new org:", ownerError)
      // Clean up
      await serviceClient.from("organization_domains").delete().eq("org_id", newOrg.id)
      await serviceClient.from("organizations").delete().eq("id", newOrg.id)
      return NextResponse.json({ error: "Failed to create organization" }, { status: 500 })
    }

    return NextResponse.json({
      organization: newOrg,
      membership: ownerMember,
      isNewOrg: true,
      isNewMember: true,
    })
  } catch (err) {
    console.error("Unexpected error in find-or-create-by-domain:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

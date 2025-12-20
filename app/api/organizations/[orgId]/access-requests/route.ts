import { getCachedAuthUser } from "@/lib/auth/cached-auth"
import { type NextRequest, NextResponse } from "next/server"
import { createDatabaseClient } from "@/lib/database/database-adapter"

// GET /api/organizations/[orgId]/access-requests - Get pending access requests
export async function GET(request: NextRequest, { params }: { params: { orgId: string } }) {
  try {
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
    const { orgId } = params

    // Verify user is admin/owner of this organization
    const { data: membership } = await db
      .from("organization_members")
      .select("role")
      .eq("org_id", orgId)
      .eq("user_id", user.id)
      .maybeSingle()

    if (!membership || !["owner", "admin"].includes(membership.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Fetch pending access requests (without join)
    const { data: requests, error } = await db
      .from("organization_access_requests")
      .select("*")
      .eq("org_id", orgId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching access requests:", error)
      return NextResponse.json({ error: "Failed to fetch access requests" }, { status: 500 })
    }

    // Fetch user details for each request
    const requestsWithUsers = await Promise.all(
      (requests || []).map(async (req) => {
        if (req.user_id) {
          const { data: userData } = await db
            .from("users")
            .select("id, email, full_name, avatar_url")
            .eq("id", req.user_id)
            .maybeSingle()
          return { ...req, users: userData }
        }
        // For pre-registered users without user_id, use stored email/name
        return {
          ...req,
          users: {
            id: null,
            email: req.email,
            full_name: req.full_name,
            avatar_url: null,
          },
        }
      }),
    )

    return NextResponse.json({ requests: requestsWithUsers })
  } catch (err) {
    console.error("Unexpected error in GET /api/organizations/[orgId]/access-requests:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST /api/organizations/[orgId]/access-requests - Create access request
export async function POST(request: NextRequest, { params }: { params: { orgId: string } }) {
  try {
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
    const { orgId } = params
    const body = await request.json()
    const { message } = body

    // Check if user already has membership
    const { data: existingMember } = await db
      .from("organization_members")
      .select("id, status")
      .eq("org_id", orgId)
      .eq("user_id", user.id)
      .maybeSingle()

    if (existingMember) {
      if (existingMember.status === "active") {
        return NextResponse.json({ error: "You are already a member of this organization" }, { status: 400 })
      }
      if (existingMember.status === "pending") {
        return NextResponse.json({ error: "Your membership is pending approval" }, { status: 400 })
      }
    }

    // Check if user already has a pending request
    const { data: existingRequest } = await db
      .from("organization_access_requests")
      .select("id, status")
      .eq("org_id", orgId)
      .eq("user_id", user.id)
      .eq("status", "pending")
      .maybeSingle()

    if (existingRequest) {
      return NextResponse.json({ error: "You already have a pending access request" }, { status: 400 })
    }

    // Get user profile
    const { data: profile } = await db.from("users").select("email, full_name").eq("id", user.id).maybeSingle()

    // Create access request
    const { data: newRequest, error } = await db
      .from("organization_access_requests")
      .insert({
        org_id: orgId,
        user_id: user.id,
        email: profile?.email || user.email,
        full_name: profile?.full_name,
        request_message: message,
        status: "pending",
      })
      .select()
      .maybeSingle()

    if (error) {
      console.error("Error creating access request:", error)
      return NextResponse.json({ error: "Failed to create access request" }, { status: 500 })
    }

    return NextResponse.json({ request: newRequest }, { status: 201 })
  } catch (err) {
    console.error("Unexpected error in POST /api/organizations/[orgId]/access-requests:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

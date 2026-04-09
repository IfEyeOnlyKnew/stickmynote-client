import { type NextRequest, NextResponse } from "next/server"
import { createServiceDatabaseClient } from "@/lib/database/database-adapter"
import { requireAuthAndOrg, safeRateLimit } from "@/lib/api/route-helpers"

// GET /api/noted/groups - List user's groups
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuthAndOrg()
    if ("response" in auth) return auth.response
    const { user, orgContext } = auth

    const db = await createServiceDatabaseClient()

    const { data, error } = await db
      .from("noted_groups")
      .select("*")
      .eq("user_id", user.id)
      .eq("org_id", orgContext.orgId)
      .order("sort_order", { ascending: true })

    if (error) {
      console.error("Error fetching groups:", error)
      return NextResponse.json({ error: "Failed to fetch groups" }, { status: 500 })
    }

    return NextResponse.json({ data: data || [] })
  } catch (err) {
    console.error("GET /api/noted/groups error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST /api/noted/groups - Create a new group
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuthAndOrg()
    if ("response" in auth) return auth.response
    const { user, orgContext } = auth

    if (!(await safeRateLimit(request, user.id, "noted_group_create"))) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429, headers: { "Retry-After": "60" } })
    }

    const body = await request.json()
    const { name, color, parent_id } = body

    if (!name || name.trim().length === 0) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 })
    }

    const db = await createServiceDatabaseClient()

    // If parent_id provided, verify it exists and belongs to user
    if (parent_id) {
      const { data: parent } = await db
        .from("noted_groups")
        .select("id")
        .eq("id", parent_id)
        .eq("user_id", user.id)
        .eq("org_id", orgContext.orgId)
        .maybeSingle()

      if (!parent) {
        return NextResponse.json({ error: "Parent group not found" }, { status: 404 })
      }
    }

    // Get max sort_order for this user
    const { data: existing } = await db
      .from("noted_groups")
      .select("sort_order")
      .eq("user_id", user.id)
      .eq("org_id", orgContext.orgId)
      .order("sort_order", { ascending: false })
      .limit(1)

    const nextOrder = existing && existing.length > 0 ? (existing[0].sort_order || 0) + 1 : 0

    const { data, error } = await db
      .from("noted_groups")
      .insert({
        user_id: user.id,
        org_id: orgContext.orgId,
        name: name.trim(),
        color: color || "#6366f1",
        sort_order: nextOrder,
        parent_id: parent_id || null,
      })
      .select("*")
      .single()

    if (error) {
      console.error("Error creating group:", error)
      return NextResponse.json({ error: "Failed to create group" }, { status: 500 })
    }

    return NextResponse.json({ data }, { status: 201 })
  } catch (err) {
    console.error("POST /api/noted/groups error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

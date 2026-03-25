import { NextResponse } from "next/server"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"
import { db as pgClient } from "@/lib/database/pg-client"

// GET /api/recognition/values - Get recognition values for org
export async function GET() {
  try {
    const authResult = await getCachedAuthUser()
    if (!authResult.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const orgContext = await getOrgContext()
    if (!orgContext) {
      return NextResponse.json({ error: "No organization context" }, { status: 403 })
    }

    const result = await pgClient.query(
      `SELECT * FROM recognition_values WHERE org_id = $1 AND is_active = true ORDER BY sort_order, name`,
      [orgContext.orgId]
    )

    return NextResponse.json({ values: result.rows || [] })
  } catch (error) {
    console.error("Error fetching recognition values:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST /api/recognition/values - Create a recognition value (admin only)
export async function POST(request: Request) {
  try {
    const authResult = await getCachedAuthUser()
    if (!authResult.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const orgContext = await getOrgContext()
    if (!orgContext) {
      return NextResponse.json({ error: "No organization context" }, { status: 403 })
    }

    if (orgContext.role !== "owner" && orgContext.role !== "admin") {
      return NextResponse.json({ error: "Only admins can manage values" }, { status: 403 })
    }

    const body = await request.json()
    const { name, description, emoji, color } = body

    if (!name?.trim()) {
      return NextResponse.json({ error: "Value name is required" }, { status: 400 })
    }

    const result = await pgClient.query(
      `INSERT INTO recognition_values (org_id, name, description, emoji, color, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [orgContext.orgId, name.trim(), description || null, emoji || "⭐", color || "#f59e0b", authResult.user.id]
    )

    return NextResponse.json({ value: result.rows[0] })
  } catch (error: any) {
    if (error?.code === "23505") {
      return NextResponse.json({ error: "A value with this name already exists" }, { status: 400 })
    }
    console.error("Error creating recognition value:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

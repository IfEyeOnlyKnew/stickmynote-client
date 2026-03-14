import { type NextRequest, NextResponse } from "next/server"
import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from "@/lib/auth/cached-auth"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { db as pgClient } from "@/lib/database/pg-client"

// GET /api/noted/templates/:id - Get a single template
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error: authError } = await getCachedAuthUser()
    if (authError === "rate_limited") return createRateLimitResponse()
    if (!user) return createUnauthorizedResponse()

    const orgContext = await getOrgContext()
    if (!orgContext) return NextResponse.json({ error: "No organization context" }, { status: 403 })

    const { id } = await params

    const result = await pgClient.query(
      `SELECT * FROM noted_templates
       WHERE id = $1
       AND (is_system = true OR (user_id = $2 AND org_id = $3))`,
      [id, user.id, orgContext.orgId]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 })
    }

    return NextResponse.json({ data: result.rows[0] })
  } catch (err) {
    console.error("GET /api/noted/templates/:id error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PUT /api/noted/templates/:id - Update a user template
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error: authError } = await getCachedAuthUser()
    if (authError === "rate_limited") return createRateLimitResponse()
    if (!user) return createUnauthorizedResponse()

    const orgContext = await getOrgContext()
    if (!orgContext) return NextResponse.json({ error: "No organization context" }, { status: 403 })

    const { id } = await params
    const body = await request.json()
    const { name, description, category, content } = body

    // Only allow editing user's own templates (not system)
    const result = await pgClient.query(
      `UPDATE noted_templates
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           category = COALESCE($3, category),
           content = COALESCE($4, content),
           updated_at = NOW()
       WHERE id = $5 AND user_id = $6 AND org_id = $7 AND is_system = false
       RETURNING *`,
      [name?.trim(), description, category, content, id, user.id, orgContext.orgId]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Template not found or not editable" }, { status: 404 })
    }

    return NextResponse.json({ data: result.rows[0] })
  } catch (err) {
    console.error("PUT /api/noted/templates/:id error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE /api/noted/templates/:id - Delete a user template
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error: authError } = await getCachedAuthUser()
    if (authError === "rate_limited") return createRateLimitResponse()
    if (!user) return createUnauthorizedResponse()

    const orgContext = await getOrgContext()
    if (!orgContext) return NextResponse.json({ error: "No organization context" }, { status: 403 })

    const { id } = await params

    const result = await pgClient.query(
      `DELETE FROM noted_templates
       WHERE id = $1 AND user_id = $2 AND org_id = $3 AND is_system = false
       RETURNING id`,
      [id, user.id, orgContext.orgId]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Template not found or not deletable" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("DELETE /api/noted/templates/:id error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

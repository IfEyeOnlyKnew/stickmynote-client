import { type NextRequest, NextResponse } from "next/server"
import { requireAuthAndOrg, safeRateLimit } from "@/lib/api/route-helpers"
import { db as pgClient } from "@/lib/database/pg-client"

// GET /api/noted/templates - List system + user templates
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuthAndOrg()
    if ("response" in auth) return auth.response
    const { user, orgContext } = auth

    const category = request.nextUrl.searchParams.get("category")

    let query = `
      SELECT * FROM noted_templates
      WHERE (is_system = true)
         OR (user_id = $1 AND org_id = $2)
    `
    const params: (string | null)[] = [user.id, orgContext.orgId]
    let paramIndex = 3

    if (category) {
      query += ` AND category = $${paramIndex}`
      params.push(category)
      paramIndex++
    }

    query += ` ORDER BY is_system DESC, sort_order ASC, created_at DESC`

    const result = await pgClient.query(query, params)

    return NextResponse.json({ data: result.rows })
  } catch (err) {
    console.error("GET /api/noted/templates error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST /api/noted/templates - Create a user template
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuthAndOrg()
    if ("response" in auth) return auth.response
    const { user, orgContext } = auth

    if (!(await safeRateLimit(request, user.id, "noted_template_create"))) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429, headers: { "Retry-After": "60" } })
    }

    const body = await request.json()
    const { name, description, category, content } = body

    if (!name || name.trim().length === 0) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 })
    }

    const result = await pgClient.query(
      `INSERT INTO noted_templates (user_id, org_id, name, description, category, content, is_system)
       VALUES ($1, $2, $3, $4, $5, $6, false)
       RETURNING *`,
      [
        user.id,
        orgContext.orgId,
        name.trim(),
        description || "",
        category || "general",
        content || "",
      ]
    )

    return NextResponse.json({ data: result.rows[0] }, { status: 201 })
  } catch (err) {
    console.error("POST /api/noted/templates error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

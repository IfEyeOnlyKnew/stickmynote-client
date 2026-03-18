import { type NextRequest, NextResponse } from "next/server"
import { createServiceDatabaseClient } from "@/lib/database/database-adapter"
import { validateUUID } from "@/lib/input-validation-enhanced"
import { applyRateLimit } from "@/lib/rate-limiter-enhanced"
import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from "@/lib/auth/cached-auth"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { db as pgClient } from "@/lib/database/pg-client"

async function safeRateLimit(request: NextRequest, userId: string, action: string) {
  try {
    const res = await applyRateLimit(request, userId, action)
    return res.success
  } catch {
    return true
  }
}

// GET /api/noted/pages/[id] - Get a single Noted page
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { user, error: authError } = await getCachedAuthUser()
    if (authError === "rate_limited") return createRateLimitResponse()
    if (!user) return createUnauthorizedResponse()

    const orgContext = await getOrgContext()
    if (!orgContext) return NextResponse.json({ error: "No organization context" }, { status: 403 })

    const params = await context.params
    if (!validateUUID(params.id)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 })

    const result = await pgClient.query(
      `SELECT np.*,
        COALESCE(np.title, s.topic, ps.topic, 'Untitled') as display_title,
        s.pad_id as pad_id
       FROM noted_pages np
       LEFT JOIN paks_pad_sticks s ON s.id = np.stick_id
       LEFT JOIN personal_sticks ps ON ps.id = np.personal_stick_id
       WHERE np.id = $1 AND np.org_id = $2
       AND (
         (np.is_personal = true AND np.user_id = $3)
         OR
         (np.is_personal = false AND (
           np.user_id = $3
           OR EXISTS (
             SELECT 1 FROM paks_pads p
             LEFT JOIN paks_pad_members pm ON pm.pad_id = p.id AND pm.user_id = $3 AND pm.accepted = true
             WHERE p.id = s.pad_id
             AND (p.owner_id = $3 OR pm.id IS NOT NULL)
           )
         ))
       )`,
      [params.id, orgContext.orgId, user.id]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Noted page not found" }, { status: 404 })
    }

    return NextResponse.json({ data: result.rows[0] })
  } catch (err) {
    console.error("GET /api/noted/pages/[id] error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PUT /api/noted/pages/[id] - Update a Noted page
export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { user, error: authError } = await getCachedAuthUser()
    if (authError === "rate_limited") return createRateLimitResponse()
    if (!user) return createUnauthorizedResponse()

    const orgContext = await getOrgContext()
    if (!orgContext) return NextResponse.json({ error: "No organization context" }, { status: 403 })

    const params = await context.params
    if (!validateUUID(params.id)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 })

    if (!(await safeRateLimit(request, user.id, "noted_update"))) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429, headers: { "Retry-After": "60" } })
    }

    const body = await request.json()
    const { title, content, group_id } = body

    // Build dynamic update
    const updates: string[] = []
    const values: (string | null)[] = []
    let paramIdx = 1

    if (title !== undefined) {
      updates.push(`title = $${paramIdx}`)
      values.push(title)
      paramIdx++
    }
    if (content !== undefined) {
      updates.push(`content = $${paramIdx}`)
      values.push(content)
      paramIdx++
    }
    if (group_id !== undefined) {
      updates.push(`group_id = $${paramIdx}`)
      values.push(group_id)
      paramIdx++
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 })
    }

    updates.push("updated_at = NOW()")

    // Only allow updating own pages or pages on pads user has access to
    const result = await pgClient.query(
      `UPDATE noted_pages SET ${updates.join(", ")}
       WHERE id = $${paramIdx} AND org_id = $${paramIdx + 1}
       AND (
         user_id = $${paramIdx + 2}
         OR (is_personal = false AND EXISTS (
           SELECT 1 FROM paks_pad_sticks s
           JOIN paks_pads p ON p.id = s.pad_id
           LEFT JOIN paks_pad_members pm ON pm.pad_id = p.id AND pm.user_id = $${paramIdx + 2} AND pm.accepted = true
           WHERE s.id = noted_pages.stick_id
           AND (p.owner_id = $${paramIdx + 2} OR pm.role IN ('admin', 'editor'))
         ))
       )
       RETURNING *`,
      [...values, params.id, orgContext.orgId, user.id]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Noted page not found or permission denied" }, { status: 404 })
    }

    return NextResponse.json({ data: result.rows[0] })
  } catch (err) {
    console.error("PUT /api/noted/pages/[id] error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE /api/noted/pages/[id] - Delete a Noted page
export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { user, error: authError } = await getCachedAuthUser()
    if (authError === "rate_limited") return createRateLimitResponse()
    if (!user) return createUnauthorizedResponse()

    const orgContext = await getOrgContext()
    if (!orgContext) return NextResponse.json({ error: "No organization context" }, { status: 403 })

    const params = await context.params
    if (!validateUUID(params.id)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 })

    if (!(await safeRateLimit(request, user.id, "noted_delete"))) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429, headers: { "Retry-After": "60" } })
    }

    const db = await createServiceDatabaseClient()

    // Only the creator can delete their Noted page
    const { data: page } = await db
      .from("noted_pages")
      .select("id, user_id")
      .eq("id", params.id)
      .eq("org_id", orgContext.orgId)
      .maybeSingle()

    if (!page) return NextResponse.json({ error: "Noted page not found" }, { status: 404 })
    if (page.user_id !== user.id) return NextResponse.json({ error: "Permission denied" }, { status: 403 })

    const { error } = await db
      .from("noted_pages")
      .delete()
      .eq("id", params.id)
      .eq("org_id", orgContext.orgId)

    if (error) {
      console.error("Error deleting Noted page:", error)
      return NextResponse.json({ error: "Failed to delete" }, { status: 500 })
    }

    return NextResponse.json({ message: "Noted page deleted" })
  } catch (err) {
    console.error("DELETE /api/noted/pages/[id] error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

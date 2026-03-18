import { type NextRequest, NextResponse } from "next/server"
import { createServiceDatabaseClient } from "@/lib/database/database-adapter"
import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from "@/lib/auth/cached-auth"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { applyRateLimit } from "@/lib/rate-limiter-enhanced"
import { db as pgClient } from "@/lib/database/pg-client"

async function safeRateLimit(request: NextRequest, userId: string, action: string) {
  try {
    const res = await applyRateLimit(request, userId, action)
    return res.success
  } catch {
    return true
  }
}

// GET /api/noted/pages - List all Noted pages the user can access
export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await getCachedAuthUser()
    if (authError === "rate_limited") return createRateLimitResponse()
    if (!user) return createUnauthorizedResponse()

    const orgContext = await getOrgContext()
    if (!orgContext) return NextResponse.json({ error: "No organization context" }, { status: 403 })

    const groupId = request.nextUrl.searchParams.get("group_id")
    const search = request.nextUrl.searchParams.get("search")
    const limit = Math.min(parseInt(request.nextUrl.searchParams.get("limit") || "30", 10), 100)
    const offset = Math.max(parseInt(request.nextUrl.searchParams.get("offset") || "0", 10), 0)

    // Permission-aware query: personal pages only for creator,
    // shared pad pages only for pad members
    let query = `
      SELECT np.*,
        COALESCE(np.title, s.topic, ps.topic, 'Untitled') as display_title,
        s.pad_id as pad_id
      FROM noted_pages np
      LEFT JOIN paks_pad_sticks s ON s.id = np.stick_id
      LEFT JOIN personal_sticks ps ON ps.id = np.personal_stick_id
      WHERE np.org_id = $1
      AND (
        -- Personal sticks: only creator
        (np.is_personal = true AND np.user_id = $2)
        OR
        -- Pad sticks: user is pad member or pad owner
        (np.is_personal = false AND (
          np.user_id = $2
          OR EXISTS (
            SELECT 1 FROM paks_pads p
            LEFT JOIN paks_pad_members pm ON pm.pad_id = p.id AND pm.user_id = $2 AND pm.accepted = true
            WHERE p.id = s.pad_id
            AND (p.owner_id = $2 OR pm.id IS NOT NULL)
          )
        ))
      )
    `
    const params: (string | number | null)[] = [orgContext.orgId, user.id]
    let paramIndex = 3

    if (groupId) {
      if (groupId === "ungrouped") {
        query += ` AND np.group_id IS NULL`
      } else {
        // Include pages in this group OR any of its sub-groups
        query += ` AND (np.group_id = $${paramIndex} OR np.group_id IN (SELECT id FROM noted_groups WHERE parent_id = $${paramIndex}))`
        params.push(groupId)
        paramIndex++
      }
    } else if (!search) {
      // No group selected and no search: only show pages from the last 90 days
      query += ` AND np.created_at >= NOW() - INTERVAL '90 days'`
    }

    if (search) {
      query += ` AND (np.title ILIKE $${paramIndex} OR np.content ILIKE $${paramIndex})`
      params.push(`%${search}%`)
      paramIndex++
    }

    // Fetch one extra to determine if there are more pages
    query += ` ORDER BY np.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`
    params.push(limit + 1, offset)

    const result = await pgClient.query(query, params)
    const hasMore = result.rows.length > limit
    const data = hasMore ? result.rows.slice(0, limit) : result.rows

    return NextResponse.json({ data, has_more: hasMore })
  } catch (err) {
    console.error("GET /api/noted/pages error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST /api/noted/pages - Create a Noted page from a Stick
export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await getCachedAuthUser()
    if (authError === "rate_limited") return createRateLimitResponse()
    if (!user) return createUnauthorizedResponse()

    const orgContext = await getOrgContext()
    if (!orgContext) return NextResponse.json({ error: "No organization context" }, { status: 403 })

    if (!(await safeRateLimit(request, user.id, "noted_create"))) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429, headers: { "Retry-After": "60" } })
    }

    const body = await request.json()
    const { stick_id, personal_stick_id, title, content, group_id, is_personal, source_content } = body

    // Allow standalone page creation (from template or blank)
    if (!stick_id && !personal_stick_id) {
      const result = await pgClient.query(
        `INSERT INTO noted_pages (user_id, org_id, title, content, group_id, is_personal, source_content)
         VALUES ($1, $2, $3, $4, $5, false, '')
         RETURNING *`,
        [user.id, orgContext.orgId, title || "Untitled", content || "", group_id || null]
      )
      return NextResponse.json({ data: result.rows[0] }, { status: 201 })
    }

    const db = await createServiceDatabaseClient()

    // Check if a Noted page already exists for this stick
    if (stick_id) {
      const { data: existing } = await db
        .from("noted_pages")
        .select("id")
        .eq("stick_id", stick_id)
        .maybeSingle()

      if (existing) {
        return NextResponse.json({ data: existing, existing: true })
      }

      // Verify user has access to the stick
      const { data: stick } = await db
        .from("paks_pad_sticks")
        .select("id, topic, content, pad_id, user_id, org_id")
        .eq("id", stick_id)
        .eq("org_id", orgContext.orgId)
        .maybeSingle()

      if (!stick) {
        return NextResponse.json({ error: "Stick not found" }, { status: 404 })
      }

      const result = await pgClient.query(
        `INSERT INTO noted_pages (stick_id, user_id, org_id, title, content, group_id, is_personal, source_content)
         VALUES ($1, $2, $3, $4, $5, $6, false, $7)
         RETURNING *`,
        [
          stick_id,
          user.id,
          orgContext.orgId,
          title || stick.topic || "Untitled",
          content || stick.content || "",
          group_id || null,
          source_content || stick.content || "",
        ]
      )

      return NextResponse.json({ data: result.rows[0] }, { status: 201 })
    }

    if (personal_stick_id) {
      const { data: existing } = await db
        .from("noted_pages")
        .select("id")
        .eq("personal_stick_id", personal_stick_id)
        .maybeSingle()

      if (existing) {
        return NextResponse.json({ data: existing, existing: true })
      }

      // Verify user owns the personal stick
      const { data: pStick } = await db
        .from("personal_sticks")
        .select("id, topic, content, user_id")
        .eq("id", personal_stick_id)
        .eq("user_id", user.id)
        .maybeSingle()

      if (!pStick) {
        return NextResponse.json({ error: "Personal stick not found" }, { status: 404 })
      }

      const result = await pgClient.query(
        `INSERT INTO noted_pages (personal_stick_id, user_id, org_id, title, content, group_id, is_personal, source_content)
         VALUES ($1, $2, $3, $4, $5, $6, true, $7)
         RETURNING *`,
        [
          personal_stick_id,
          user.id,
          orgContext.orgId,
          title || pStick.topic || "Untitled",
          content || pStick.content || "",
          group_id || null,
          source_content || pStick.content || "",
        ]
      )

      return NextResponse.json({ data: result.rows[0] }, { status: 201 })
    }

    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  } catch (err) {
    console.error("POST /api/noted/pages error:", err)
    if (err instanceof Error && err.message.includes("uq_noted_stick")) {
      return NextResponse.json({ error: "This stick already has a Noted page" }, { status: 409 })
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

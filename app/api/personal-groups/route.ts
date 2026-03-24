import { type NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/database/pg-client"
import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from "@/lib/auth/cached-auth"

// GET - List all groups for the current user
export async function GET() {
  try {
    const { user, error: authError } = await getCachedAuthUser()
    if (authError === "rate_limited") return createRateLimitResponse()
    if (!user) return createUnauthorizedResponse()

    const result = await db.query(
      `SELECT g.id, g.name, g.color, g.sort_order, g.created_at,
              COUNT(m.stick_id)::int AS stick_count
       FROM personal_stick_groups g
       LEFT JOIN personal_stick_group_members m ON m.group_id = g.id
       WHERE g.user_id = $1
       GROUP BY g.id
       ORDER BY g.sort_order, g.name`,
      [user.id]
    )

    return NextResponse.json({ groups: result.rows })
  } catch (error) {
    console.error("[personal-groups] GET error:", error)
    return NextResponse.json({ error: "Failed to fetch groups" }, { status: 500 })
  }
}

// POST - Create a new group
export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await getCachedAuthUser()
    if (authError === "rate_limited") return createRateLimitResponse()
    if (!user) return createUnauthorizedResponse()

    const { name, color } = await request.json()
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "Group name is required" }, { status: 400 })
    }
    if (name.trim().length > 100) {
      return NextResponse.json({ error: "Group name must be 100 characters or less" }, { status: 400 })
    }

    // Get next sort order
    const sortResult = await db.query(
      `SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order
       FROM personal_stick_groups WHERE user_id = $1`,
      [user.id]
    )
    const nextOrder = sortResult.rows[0].next_order

    const result = await db.query(
      `INSERT INTO personal_stick_groups (user_id, name, color, sort_order)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, color, sort_order, created_at`,
      [user.id, name.trim(), color || "#6366f1", nextOrder]
    )

    return NextResponse.json({ group: { ...result.rows[0], stick_count: 0 } }, { status: 201 })
  } catch (error) {
    console.error("[personal-groups] POST error:", error)
    return NextResponse.json({ error: "Failed to create group" }, { status: 500 })
  }
}

// PUT - Update a group (rename, recolor)
export async function PUT(request: NextRequest) {
  try {
    const { user, error: authError } = await getCachedAuthUser()
    if (authError === "rate_limited") return createRateLimitResponse()
    if (!user) return createUnauthorizedResponse()

    const { id, name, color } = await request.json()
    if (!id) {
      return NextResponse.json({ error: "Group id is required" }, { status: 400 })
    }

    const updates: string[] = []
    const values: (string | number)[] = []
    let paramIndex = 1

    if (name !== undefined) {
      if (typeof name !== "string" || name.trim().length === 0) {
        return NextResponse.json({ error: "Group name cannot be empty" }, { status: 400 })
      }
      updates.push(`name = $${paramIndex++}`)
      values.push(name.trim())
    }
    if (color !== undefined) {
      updates.push(`color = $${paramIndex++}`)
      values.push(color)
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 })
    }

    updates.push(`updated_at = NOW()`)
    values.push(id, user.id)

    const result = await db.query(
      `UPDATE personal_stick_groups
       SET ${updates.join(", ")}
       WHERE id = $${paramIndex++} AND user_id = $${paramIndex}
       RETURNING id, name, color, sort_order, created_at`,
      values
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 })
    }

    return NextResponse.json({ group: result.rows[0] })
  } catch (error) {
    console.error("[personal-groups] PUT error:", error)
    return NextResponse.json({ error: "Failed to update group" }, { status: 500 })
  }
}

// DELETE - Delete a group
export async function DELETE(request: NextRequest) {
  try {
    const { user, error: authError } = await getCachedAuthUser()
    if (authError === "rate_limited") return createRateLimitResponse()
    if (!user) return createUnauthorizedResponse()

    const { id } = await request.json()
    if (!id) {
      return NextResponse.json({ error: "Group id is required" }, { status: 400 })
    }

    const result = await db.query(
      `DELETE FROM personal_stick_groups WHERE id = $1 AND user_id = $2 RETURNING id`,
      [id, user.id]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[personal-groups] DELETE error:", error)
    return NextResponse.json({ error: "Failed to delete group" }, { status: 500 })
  }
}

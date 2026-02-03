import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth/local-auth"
import { db } from "@/lib/database/pg-client"

export const dynamic = "force-dynamic"

// GET /api/user/profile - Get user profile
export async function GET() {
  try {
    const session = await getSession()

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const result = await db.query(
      `SELECT id, email, username, bio, website, location, full_name, avatar_url,
              phone, organize_notes, created_at, updated_at, hub_mode, email_verified, timezone
       FROM users
       WHERE id = $1`,
      [session.user.id]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    return NextResponse.json(result.rows[0])
  } catch (error) {
    console.error("[API] Error fetching user profile:", error)
    return NextResponse.json({ error: "Failed to fetch profile" }, { status: 500 })
  }
}

// PUT /api/user/profile - Update user profile
export async function PUT(request: NextRequest) {
  try {
    const session = await getSession()

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const userId = session.user.id

    // Build dynamic update query based on provided fields
    const allowedFields = ["username", "bio", "website", "location", "full_name", "phone", "organize_notes", "hub_mode", "timezone"]
    const updates: string[] = []
    const values: any[] = []
    let paramIndex = 1

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates.push(`${field} = $${paramIndex}`)
        values.push(body[field])
        paramIndex++
      }
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 })
    }

    // Add updated_at
    updates.push(`updated_at = NOW()`)

    // Add user_id for WHERE clause
    values.push(userId)

    const result = await db.query(
      `UPDATE users SET ${updates.join(", ")} WHERE id = $${paramIndex} RETURNING *`,
      values
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    return NextResponse.json({ profile: result.rows[0] })
  } catch (error) {
    console.error("[API] Error updating user profile:", error)
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 })
  }
}

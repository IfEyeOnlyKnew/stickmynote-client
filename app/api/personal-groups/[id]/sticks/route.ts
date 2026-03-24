import { type NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/database/pg-client"
import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from "@/lib/auth/cached-auth"

// POST - Add a stick to a group
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error: authError } = await getCachedAuthUser()
    if (authError === "rate_limited") return createRateLimitResponse()
    if (!user) return createUnauthorizedResponse()

    const { id: groupId } = await params
    const { stickId } = await request.json()

    if (!stickId) {
      return NextResponse.json({ error: "stickId is required" }, { status: 400 })
    }

    // Verify the group belongs to this user
    const groupCheck = await db.query(
      `SELECT id FROM personal_stick_groups WHERE id = $1 AND user_id = $2`,
      [groupId, user.id]
    )
    if (groupCheck.rows.length === 0) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 })
    }

    // Verify the stick belongs to this user
    const stickCheck = await db.query(
      `SELECT id FROM personal_sticks WHERE id = $1 AND user_id = $2`,
      [stickId, user.id]
    )
    if (stickCheck.rows.length === 0) {
      return NextResponse.json({ error: "Stick not found" }, { status: 404 })
    }

    await db.query(
      `INSERT INTO personal_stick_group_members (group_id, stick_id)
       VALUES ($1, $2)
       ON CONFLICT (group_id, stick_id) DO NOTHING`,
      [groupId, stickId]
    )

    return NextResponse.json({ success: true }, { status: 201 })
  } catch (error) {
    console.error("[personal-groups/sticks] POST error:", error)
    return NextResponse.json({ error: "Failed to add stick to group" }, { status: 500 })
  }
}

// DELETE - Remove a stick from a group
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error: authError } = await getCachedAuthUser()
    if (authError === "rate_limited") return createRateLimitResponse()
    if (!user) return createUnauthorizedResponse()

    const { id: groupId } = await params
    const { stickId } = await request.json()

    if (!stickId) {
      return NextResponse.json({ error: "stickId is required" }, { status: 400 })
    }

    // Verify the group belongs to this user
    const groupCheck = await db.query(
      `SELECT id FROM personal_stick_groups WHERE id = $1 AND user_id = $2`,
      [groupId, user.id]
    )
    if (groupCheck.rows.length === 0) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 })
    }

    await db.query(
      `DELETE FROM personal_stick_group_members WHERE group_id = $1 AND stick_id = $2`,
      [groupId, stickId]
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[personal-groups/sticks] DELETE error:", error)
    return NextResponse.json({ error: "Failed to remove stick from group" }, { status: 500 })
  }
}

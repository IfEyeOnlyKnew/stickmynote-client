import { NextResponse } from "next/server"
import { db } from "@/lib/database/pg-client"
import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from "@/lib/auth/cached-auth"

// GET - Return all group memberships for the current user's sticks
// Returns { memberships: { group_id: string, stick_id: string }[] }
export async function GET() {
  try {
    const { user, error: authError } = await getCachedAuthUser()
    if (authError === "rate_limited") return createRateLimitResponse()
    if (!user) return createUnauthorizedResponse()

    const result = await db.query(
      `SELECT m.group_id, m.stick_id
       FROM personal_stick_group_members m
       JOIN personal_stick_groups g ON g.id = m.group_id
       WHERE g.user_id = $1`,
      [user.id]
    )

    return NextResponse.json({ memberships: result.rows })
  } catch (error) {
    console.error("[personal-groups/memberships] GET error:", error)
    return NextResponse.json({ error: "Failed to fetch memberships" }, { status: 500 })
  }
}

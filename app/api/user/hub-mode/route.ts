import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth/local-auth"
import { db } from "@/lib/database/pg-client"

export const dynamic = "force-dynamic"

// PATCH /api/user/hub-mode - Update user's hub mode preference
export async function PATCH(request: NextRequest) {
  try {
    const session = await getSession()

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { hub_mode } = body

    if (!hub_mode || !["personal_only", "full_access"].includes(hub_mode)) {
      return NextResponse.json(
        { error: "Invalid hub_mode. Must be 'personal_only' or 'full_access'" },
        { status: 400 }
      )
    }

    const result = await db.query(
      `UPDATE users SET hub_mode = $1, updated_at = NOW() WHERE id = $2 RETURNING id, hub_mode`,
      [hub_mode, session.user.id]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    return NextResponse.json({ 
      success: true, 
      hub_mode: result.rows[0].hub_mode 
    })
  } catch (error) {
    console.error("[API] Error updating hub mode:", error)
    return NextResponse.json({ error: "Failed to update hub mode" }, { status: 500 })
  }
}

// GET /api/user/hub-mode - Get current user's hub mode
export async function GET() {
  try {
    const session = await getSession()

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const result = await db.query(
      `SELECT hub_mode FROM users WHERE id = $1`,
      [session.user.id]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    return NextResponse.json({ hub_mode: result.rows[0].hub_mode })
  } catch (error) {
    console.error("[API] Error getting hub mode:", error)
    return NextResponse.json({ error: "Failed to get hub mode" }, { status: 500 })
  }
}

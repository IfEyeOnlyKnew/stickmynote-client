import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth/local-auth"
import { db } from "@/lib/database/pg-client"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const session = await getSession()

    if (!session) {
      console.log("[API /user/me] No session found - returning 401")
      return NextResponse.json({ user: null }, { status: 401 })
    }

    console.log("[API /user/me] Session found for user:", session.user.id)

    // Get full user profile
    const result = await db.query(
      `SELECT id, email, username, bio, website, location, full_name, avatar_url, 
              phone, organize_notes, created_at, updated_at, hub_mode, email_verified, login_count
       FROM users 
       WHERE id = $1`,
      [session.user.id]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ user: null }, { status: 404 })
    }

    const user = result.rows[0]

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        email_confirmed_at: user.email_verified ? new Date().toISOString() : null,
      },
      profile: {
        id: user.id,
        email: user.email,
        username: user.username,
        bio: user.bio,
        website: user.website,
        location: user.location,
        full_name: user.full_name,
        avatar_url: user.avatar_url,
        phone: user.phone,
        organize_notes: user.organize_notes,
        created_at: user.created_at,
        updated_at: user.updated_at,
        hub_mode: user.hub_mode,
        login_count: user.login_count || 0,
      },
    })
  } catch (error) {
    console.error("[API] Error fetching user:", error)
    return NextResponse.json(
      { error: "Failed to fetch user" },
      { status: 500 }
    )
  }
}

"use server"

import { NextResponse } from "next/server"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"
import { db } from "@/lib/database/pg-client"

// GET - Get current authenticated user
export async function GET() {
  try {
    const authResult = await getCachedAuthUser()
    if (!authResult?.user) {
      return NextResponse.json({ user: null })
    }

    // Get full user profile from database
    const result = await db.query(
      `SELECT id, email, full_name, display_name, avatar_url, username, bio, website, location, phone, hub_mode
       FROM users WHERE id = $1`,
      [authResult.user.id]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ user: null })
    }

    const user = result.rows[0]

    return NextResponse.json({ 
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        display_name: user.display_name,
        avatar_url: user.avatar_url,
        username: user.username,
        bio: user.bio,
        website: user.website,
        location: user.location,
        phone: user.phone,
        hub_mode: user.hub_mode,
      }
    })
  } catch (error) {
    console.error("Error getting current user:", error)
    return NextResponse.json({ user: null })
  }
}

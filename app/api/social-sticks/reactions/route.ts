import { createDatabaseClient } from "@/lib/database/database-adapter"
import { NextResponse } from "next/server"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

export async function GET() {
  try {
    const db = await createDatabaseClient()

    const { user, rateLimited } = await getCachedAuthUser()

    if (rateLimited) {
      return NextResponse.json({ reactions: [] })
    }

    if (!user) {
      return NextResponse.json({ reactions: [] })
    }

    // Get user's organization
    const { data: membership } = await db
      .from("organization_members")
      .select("org_id")
      .eq("user_id", user.id)
      .maybeSingle()

    if (!membership?.org_id) {
      return NextResponse.json({ reactions: [] })
    }

    // Get all reactions for sticks in the user's organization
    const { data: reactions, error } = await db
      .from("social_stick_reactions") // Fixed table name from social_sticks_reactions to social_stick_reactions (singular)
      .select(`
        id,
        social_stick_id,
        user_id,
        reaction_type,
        created_at
      `)
      .eq("org_id", membership.org_id)
      .order("created_at", { ascending: false })
      .limit(500)

    if (error) {
      console.error("Error fetching reactions:", error)
      return NextResponse.json({ reactions: [] })
    }

    return NextResponse.json({ reactions: reactions || [] })
  } catch (error) {
    console.error("Error in reactions endpoint:", error)
    return NextResponse.json({ reactions: [] })
  }
}

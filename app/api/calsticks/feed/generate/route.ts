import { NextResponse } from "next/server"
import { createServiceDatabaseClient } from "@/lib/database/database-adapter"
import { randomBytes } from "crypto"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

export async function POST(request: Request) {
  try {
    const db = await createServiceDatabaseClient()
    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) {
      return NextResponse.json({ error: "Rate limited" }, { status: 429, headers: { "Retry-After": "30" } })
    }
    if (!authResult.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const user = { id: authResult.userId }

    // Generate a secure random token
    const token = randomBytes(32).toString("hex")

    const { data, error } = await db
      .from("calendar_feeds")
      .upsert(
        {
          user_id: user.id,
          name: "My CalSticks",
          token: token,
          is_active: true,
          filters: { include_completed: false },
        },
        { onConflict: "user_id, name" },
      )
      .select()
      .maybeSingle()

    if (error) throw error

    // Return the full feed URL
    const protocol = process.env.NODE_ENV === "development" ? "http" : "https"
    const host = request.headers.get("host") || "localhost:3000"
    const feedUrl = `${protocol}://${host}/api/calsticks/feed/ical/${token}`

    return NextResponse.json({ url: feedUrl, token })
  } catch (error) {
    console.error("Error generating feed token:", error)
    return NextResponse.json({ error: "Failed to generate feed" }, { status: 500 })
  }
}

export async function GET(request: Request) {
  try {
    const db = await createServiceDatabaseClient()
    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) {
      return NextResponse.json({ error: "Rate limited" }, { status: 429, headers: { "Retry-After": "30" } })
    }
    if (!authResult.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const user = { id: authResult.userId }

    const { data: feed } = await db
      .from("calendar_feeds")
      .select("token")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle()

    if (!feed) {
      return NextResponse.json({ url: null })
    }

    const protocol = process.env.NODE_ENV === "development" ? "http" : "https"
    const host = request.headers.get("host") || "localhost:3000"
    const feedUrl = `${protocol}://${host}/api/calsticks/feed/ical/${feed.token}`

    return NextResponse.json({ url: feedUrl, token: feed.token })
  } catch (error) {
    console.error("Error fetching feed:", error)
    return NextResponse.json({ error: "Failed to fetch feed" }, { status: 500 })
  }
}

import { createDatabaseClient } from "@/lib/database/database-adapter"
import { NextResponse } from "next/server"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

// GET /api/saved-searches - Fetch saved searches
export async function GET(request: Request) {
  try {
    const db = await createDatabaseClient()

    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again in a moment." },
        { status: 429, headers: { "Retry-After": "30" } },
      )
    }
    if (!authResult.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const user = authResult.user

    const { data, error } = await db
      .from("saved_searches")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("[v0] Error fetching saved searches:", error)
      return NextResponse.json({ error: "Failed to fetch saved searches" }, { status: 500 })
    }

    return NextResponse.json({ savedSearches: data })
  } catch (error) {
    console.error("[v0] Error in saved searches GET:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST /api/saved-searches - Create saved search
export async function POST(request: Request) {
  try {
    const db = await createDatabaseClient()

    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again in a moment." },
        { status: 429, headers: { "Retry-After": "30" } },
      )
    }
    if (!authResult.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const user = authResult.user

    const body = await request.json()
    const { name, query, filters } = body

    if (!name || !query) {
      return NextResponse.json({ error: "Name and query are required" }, { status: 400 })
    }

    const { data, error } = await db
      .from("saved_searches")
      .insert({
        user_id: user.id,
        name,
        query,
        filters: filters || {},
      })
      .select()
      .single()

    if (error) {
      console.error("[v0] Error creating saved search:", error)
      return NextResponse.json({ error: "Failed to create saved search" }, { status: 500 })
    }

    return NextResponse.json({ savedSearch: data })
  } catch (error) {
    console.error("[v0] Error in saved search POST:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

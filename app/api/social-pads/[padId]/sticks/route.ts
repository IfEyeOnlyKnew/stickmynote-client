import { createDatabaseClient, createServiceDatabaseClient } from "@/lib/database/database-adapter"
import { NextResponse } from "next/server"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

interface User {
  id: string
  email: string | null
  full_name: string | null
  avatar_url: string | null
  username: string | null
}

const USER_SELECT_FIELDS = "id, email, full_name, avatar_url, username"
const RATE_LIMIT_HEADERS = { "Retry-After": "30" }

export async function GET(request: Request, { params }: { params: Promise<{ padId: string }> }) {
  try {
    const { padId } = await params
    const db = await createDatabaseClient()
    const serviceDb = await createServiceDatabaseClient()

    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers: RATE_LIMIT_HEADERS },
      )
    }

    const { data: sticks, error: sticksError } = await db
      .from("social_sticks")
      .select("*")
      .eq("social_pad_id", padId)
      .order("created_at", { ascending: false })

    if (sticksError) throw sticksError

    const userIds = [...new Set(sticks?.map((s) => s.user_id).filter(Boolean) || [])]

    if (!userIds.length) {
      return NextResponse.json(sticks || [])
    }

    const { data: users } = await serviceDb
      .from("users")
      .select(USER_SELECT_FIELDS)
      .in("id", userIds)

    const usersMap = new Map((users as User[])?.map((u) => [u.id, u]) || [])

    const sticksWithUsers = sticks?.map((stick) => {
      const stickUser = usersMap.get(stick.user_id)
      return {
        ...stick,
        user: stickUser || {
          id: stick.user_id,
          email: null,
          full_name: null,
          avatar_url: null,
          username: null,
        },
      }
    })

    return NextResponse.json(sticksWithUsers || [])
  } catch (error) {
    console.error("[v0] Error fetching sticks:", error)
    return NextResponse.json({ error: "Failed to fetch sticks" }, { status: 500 })
  }
}

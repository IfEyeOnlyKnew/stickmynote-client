import { createServerClient } from "@/lib/supabase/server"
import { getServiceClient } from "@/lib/supabase/service-client"
import { NextResponse } from "next/server"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

type User = {
  id: string
  email: string | null
  full_name: string | null
  avatar_url: string | null
  username: string | null
}

export async function GET(request: Request, { params }: { params: Promise<{ padId: string }> }) {
  try {
    const { padId } = await params
    const supabase = await createServerClient()
    const serviceSupabase = getServiceClient()

    const authResult = await getCachedAuthUser(supabase)
    if (authResult.rateLimited) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers: { "Retry-After": "30" } },
      )
    }

    const sticksQuery = supabase
      .from("social_sticks")
      .select("*")
      .eq("social_pad_id", padId)
      .order("created_at", { ascending: false })

    const { data: sticks, error: sticksError } = await sticksQuery

    if (sticksError) throw sticksError

    const userIds = [...new Set(sticks?.map((s) => s.user_id).filter(Boolean) || [])]

    const { data: users } = await serviceSupabase
      .from("users")
      .select("id, email, full_name, avatar_url, username")
      .in("id", userIds)
      .returns<User[]>()

    const usersMap = new Map(users?.map((u) => [u.id, u]) || [])

    const sticksWithUsers = sticks?.map((stick) => {
      const user = usersMap.get(stick.user_id)
      return {
        ...stick,
        user: user || {
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

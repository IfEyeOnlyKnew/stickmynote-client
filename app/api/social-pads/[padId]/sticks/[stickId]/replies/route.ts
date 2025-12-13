import { createServerClient } from "@/lib/supabase/server"
import { getServiceClient } from "@/lib/supabase/service-client"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { NextResponse } from "next/server"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

type User = {
  id: string
  email: string | null
  full_name: string | null
  avatar_url: string | null
  username: string | null
}

export async function GET(request: Request, { params }: { params: Promise<{ padId: string; stickId: string }> }) {
  try {
    const { stickId } = await params
    const supabase = await createServerClient()
    const serviceSupabase = getServiceClient()

    const authResult = await getCachedAuthUser(supabase)
    // Note: This route allows unauthenticated access for public content
    const user = authResult.user

    let orgId: string | null = null
    if (user) {
      const orgContext = await getOrgContext(user.id)
      orgId = orgContext?.orgId || null
    }

    let query = supabase
      .from("social_stick_replies")
      .select("*")
      .eq("stick_id", stickId)
      .order("created_at", { ascending: true })

    if (orgId) {
      query = query.eq("org_id", orgId)
    }

    const { data: replies, error: repliesError } = await query

    if (repliesError) throw repliesError

    const userIds = [...new Set(replies?.map((r) => r.user_id).filter(Boolean) || [])]

    const { data: users } = await serviceSupabase
      .from("users")
      .select("id, email, full_name, avatar_url, username")
      .in("id", userIds.length > 0 ? userIds : ["00000000-0000-0000-0000-000000000000"])
      .returns<User[]>()

    const usersMap = new Map(users?.map((u) => [u.id, u]) || [])

    const repliesWithUsers = replies?.map((reply) => {
      const user = usersMap.get(reply.user_id)
      return {
        ...reply,
        user: user || {
          id: reply.user_id,
          email: null,
          full_name: null,
          avatar_url: null,
          username: null,
        },
      }
    })

    return NextResponse.json(repliesWithUsers || [])
  } catch (error) {
    console.error("[v0] Error fetching replies:", error)
    return NextResponse.json({ error: "Failed to fetch replies" }, { status: 500 })
  }
}

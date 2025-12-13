import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"
import { createServerClient as createAppServerClient } from "@/lib/supabase/server"

type UserData = {
  id: string
  full_name: string | null
  email: string
  username: string | null
  avatar_url: string | null
}

type SocialPadData = {
  id: string
  name: string
  is_public: boolean
  owner_id: string
}

type StickData = {
  id: string
  topic: string | null
  content: string
  color: string | null
  created_at: string
  updated_at: string | null
  social_pad_id: string
  user_id: string
  is_public: boolean
  social_pads: SocialPadData
  users: UserData | null
  reply_count?: number
}

type RawStickData = {
  id: string
  topic: string | null
  content: string
  color: string | null
  created_at: string
  updated_at: string | null
  social_pad_id: string
  user_id: string
  is_public: boolean
  social_pads: SocialPadData | SocialPadData[]
  users: UserData | UserData[] | null
}

export async function GET(request: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
      },
    },
  })

  const appSupabase = await createAppServerClient()
  const authResult = await getCachedAuthUser(appSupabase)
  if (authResult.rateLimited) {
    return NextResponse.json({ error: "Rate limited" }, { status: 429, headers: { "Retry-After": "30" } })
  }
  if (!authResult.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const user = authResult.user

  const orgContext = await getOrgContext(user.id)
  if (!orgContext) {
    return NextResponse.json({ error: "No organization context" }, { status: 403 })
  }

  const searchParams = request.nextUrl.searchParams
  const query = searchParams.get("q") || ""
  const dateFrom = searchParams.get("dateFrom")
  const dateTo = searchParams.get("dateTo")
  const visibility = searchParams.get("visibility") // "public", "private", "all"
  const authorId = searchParams.get("authorId")
  const padId = searchParams.get("padId")
  const tags = searchParams.get("tags")?.split(",").filter(Boolean) || []
  const category = searchParams.get("category")
  const includeReplies = searchParams.get("includeReplies") === "true"
  const sortBy = searchParams.get("sortBy") || "created_at" // "created_at", "replies", "relevance"
  const sortOrder = searchParams.get("sortOrder") || "desc"

  try {
    let sticksQuery = supabase
      .from("social_sticks")
      .select(
        `
        id,
        topic,
        content,
        color,
        created_at,
        updated_at,
        social_pad_id,
        user_id,
        is_public,
        social_pads!inner(id, name, is_public, owner_id),
        users(id, full_name, email, username, avatar_url)
      `,
      )
      .eq("org_id", orgContext.orgId)

    const { data: accessiblePadIds } = await supabase
      .from("social_pad_members")
      .select("social_pad_id")
      .eq("user_id", user.id)
      .eq("org_id", orgContext.orgId)

    const padIds = accessiblePadIds?.map((p) => p.social_pad_id) || []

    // User can see: public pads, pads they own, or pads they're a member of
    sticksQuery = sticksQuery.or(
      `social_pads.is_public.eq.true,social_pads.owner_id.eq.${user.id},social_pad_id.in.(${padIds.join(",")})`,
    )

    if (visibility === "public") {
      sticksQuery = sticksQuery.eq("social_pads.is_public", true)
    } else if (visibility === "private") {
      sticksQuery = sticksQuery.eq("social_pads.is_public", false)
    }

    if (authorId) {
      sticksQuery = sticksQuery.eq("user_id", authorId)
    }

    if (padId) {
      sticksQuery = sticksQuery.eq("social_pad_id", padId)
    }

    if (dateFrom) {
      sticksQuery = sticksQuery.gte("created_at", dateFrom)
    }

    if (dateTo) {
      sticksQuery = sticksQuery.lte("created_at", dateTo)
    }

    const { data: sticks, error: sticksError } = await sticksQuery

    if (sticksError) {
      console.error("[v0] Error fetching sticks:", sticksError)
      return NextResponse.json({ error: sticksError.message }, { status: 500 })
    }

    const stickIds = sticks?.map((s) => s.id) || []
    const { data: replyCounts } = await supabase
      .from("social_stick_replies")
      .select("social_stick_id")
      .in("social_stick_id", stickIds)
      .eq("org_id", orgContext.orgId)

    const replyCountMap: Record<string, number> = {}
    replyCounts?.forEach((reply) => {
      replyCountMap[reply.social_stick_id] = (replyCountMap[reply.social_stick_id] || 0) + 1
    })

    let filteredSticks = ((sticks || []) as RawStickData[]).map(
      (stick): StickData => ({
        ...stick,
        social_pads: Array.isArray(stick.social_pads) ? stick.social_pads[0] : stick.social_pads,
        users: Array.isArray(stick.users) ? stick.users[0] : stick.users,
        reply_count: replyCountMap[stick.id] || 0,
      }),
    )

    if (query) {
      const lowerQuery = query.toLowerCase()
      filteredSticks = filteredSticks.filter((stick) => {
        const userData = Array.isArray(stick.users) ? stick.users[0] : stick.users
        return (
          stick.topic?.toLowerCase().includes(lowerQuery) ||
          stick.content?.toLowerCase().includes(lowerQuery) ||
          userData?.full_name?.toLowerCase().includes(lowerQuery) ||
          userData?.email?.toLowerCase().includes(lowerQuery)
        )
      })
    }

    let replyResults: any[] = []
    if (includeReplies && query) {
      const { data: replies } = await supabase
        .from("social_stick_replies")
        .select(
          `
          id,
          content,
          category,
          created_at,
          social_stick_id,
          user_id,
          users(id, full_name, email, username, avatar_url),
          social_sticks!inner(
            id,
            topic,
            social_pad_id,
            social_pads(id, name, is_public)
          )
        `,
        )
        .ilike("content", `%${query}%`)
        .eq("org_id", orgContext.orgId)

      replyResults = (replies || []).filter((reply: any) => {
        // Check if user has access to the pad
        const padIsPublic = reply.social_sticks?.social_pads?.is_public
        const isInPads = padIds.includes(reply.social_sticks?.social_pad_id)
        return padIsPublic || isInPads
      })
    }

    if (sortBy === "replies") {
      filteredSticks.sort((a, b) => {
        const diff = (b.reply_count || 0) - (a.reply_count || 0)
        return sortOrder === "desc" ? diff : -diff
      })
    } else if (sortBy === "created_at") {
      filteredSticks.sort((a, b) => {
        const diff = new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        return sortOrder === "desc" ? diff : -diff
      })
    } else if (sortBy === "updated_at") {
      filteredSticks.sort((a, b) => {
        const diff = new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime()
        return sortOrder === "desc" ? diff : -diff
      })
    }

    const authors = Array.from(
      new Set(
        filteredSticks.map((s) => {
          const userData = Array.isArray(s.users) ? s.users[0] : s.users
          return {
            id: s.user_id,
            name: userData?.full_name || userData?.email || "Unknown",
            email: userData?.email || "",
          }
        }),
      ),
    )

    const pads = Array.from(
      new Set(
        filteredSticks.map((s) => ({
          id: s.social_pad_id,
          name: s.social_pads?.name || "Unknown",
        })),
      ),
    )

    return NextResponse.json({
      sticks: filteredSticks,
      replies: replyResults,
      metadata: {
        totalSticks: filteredSticks.length,
        totalReplies: replyResults.length,
        authors,
        pads,
      },
    })
  } catch (error) {
    console.error("[v0] Search error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

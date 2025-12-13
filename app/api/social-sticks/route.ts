import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service-client"
import { NextResponse } from "next/server"
import { APICache, withCache } from "@/lib/api-cache"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from "@/lib/auth/cached-auth"
import type { OrgContext } from "@/lib/auth/get-org-context"

const ADMIN_EMAILS = ["chrisdoran63@outlook.com"]

type User = {
  id: string
  full_name: string | null
  email: string
  avatar_url: string | null
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const isPublic = searchParams.get("public") === "true"
    const isAdmin = searchParams.get("admin") === "true"
    const isPrivate = searchParams.get("private") === "true"

    const supabase = await createClient()

    const { user, error: authError } = await getCachedAuthUser()

    if (authError === "rate_limited") {
      return NextResponse.json(
        { error: "Too many requests. Please try again in a moment." },
        { status: 429, headers: { "Retry-After": "5" } },
      )
    }

    let orgContext: OrgContext | null = null
    if (user) {
      try {
        orgContext = await getOrgContext()
      } catch (orgError) {
        if (orgError instanceof Error && orgError.message === "RATE_LIMITED") {
          return NextResponse.json(
            { error: "Too many requests. Please try again in a moment." },
            { status: 429, headers: { "Retry-After": "5" } },
          )
        }
        console.error("[v0] Error getting org context:", orgError)
      }
    }

    if (user && !orgContext) {
      console.error("[v0] User authenticated but no orgContext:", user.email)
    }

    const enrichSticksWithData = async (sticks: any[]) => {
      if (!sticks || sticks.length === 0) {
        return []
      }

      const userIds = [...new Set(sticks.map((stick) => stick.user_id).filter(Boolean))]

      const serviceClient = createServiceClient()
      const { data: users, error: usersError } = await serviceClient
        .from("users")
        .select("id, full_name, email, avatar_url")
        .in("id", userIds)
        .returns<User[]>()

      if (usersError) {
        console.error("[v0] Error fetching users:", usersError)
      }

      const usersMap = new Map(users?.map((u) => [u.id, u]) || [])

      const stickIds = sticks.map((stick) => stick.id)

      const { data: replyCounts, error: replyError } = await supabase
        .from("social_stick_replies")
        .select("social_stick_id")
        .in("social_stick_id", stickIds)

      if (replyError) {
        console.error("[v0] Error fetching reply counts:", replyError)
      }

      const replyCountMap = new Map<string, number>()
      replyCounts?.forEach((reply) => {
        replyCountMap.set(reply.social_stick_id, (replyCountMap.get(reply.social_stick_id) || 0) + 1)
      })

      const enrichedSticks = sticks.map((stick) => ({
        ...stick,
        users: stick.user_id ? usersMap.get(stick.user_id) || null : null,
        reply_count: replyCountMap.get(stick.id) || 0,
      }))

      return enrichedSticks
    }

    if (isPublic) {
      const cacheKey = APICache.getCacheKey("social-sticks", { public: true })

      return withCache(
        cacheKey,
        async () => {
          const { data: publicSticks, error } = await supabase
            .from("social_sticks")
            .select(`
              *,
              social_pads!inner(id, name, is_public)
            `)
            .eq("social_pads.is_public", true)
            .order("created_at", { ascending: false })

          if (error) {
            console.error("[v0] Error fetching public sticks:", error)
            throw error
          }

          const enrichedSticks = await enrichSticksWithData(publicSticks || [])
          return { sticks: enrichedSticks }
        },
        { ttl: 60, staleWhileRevalidate: 300 },
      )
    }

    if (isPrivate) {
      if (!user || !orgContext) {
        return NextResponse.json(
          {
            error: "Unauthorized",
            details: !user ? "No authenticated user" : "No organization context",
          },
          { status: 401 },
        )
      }

      const validatedUser = user
      const validatedOrgContext = orgContext

      const cacheKey = APICache.getCacheKey("social-sticks", {
        private: true,
        userId: validatedUser.id,
        orgId: validatedOrgContext.orgId,
      })

      return withCache(
        cacheKey,
        async () => {
          const { data: ownedPrivatePads } = await supabase
            .from("social_pads")
            .select("id")
            .eq("owner_id", validatedUser.id)
            .eq("org_id", validatedOrgContext.orgId)
            .eq("is_public", false)

          const { data: memberPadIds } = await supabase
            .from("social_pad_members")
            .select("social_pad_id")
            .eq("user_id", validatedUser.id)
            .eq("org_id", validatedOrgContext.orgId)
            .eq("accepted", true)

          const memberPadIdList = memberPadIds?.map((m) => m.social_pad_id) || []

          let memberPrivatePadIds: string[] = []
          if (memberPadIdList.length > 0) {
            const { data: memberPads } = await supabase
              .from("social_pads")
              .select("id, is_public")
              .in("id", memberPadIdList)
              .eq("org_id", validatedOrgContext.orgId)
              .eq("is_public", false)

            memberPrivatePadIds = memberPads?.map((p) => p.id) || []
          }

          const privatePadIds = [...(ownedPrivatePads?.map((p) => p.id) || []), ...memberPrivatePadIds]

          if (privatePadIds.length === 0) {
            return { sticks: [] }
          }

          const { data: privateSticks, error } = await supabase
            .from("social_sticks")
            .select(`
              *,
              social_pads(id, name, is_public)
            `)
            .in("social_pad_id", privatePadIds)
            .eq("org_id", validatedOrgContext.orgId)
            .order("created_at", { ascending: false })

          if (error) {
            console.error("[v0] Error fetching private sticks:", error)
            throw error
          }

          const enrichedSticks = await enrichSticksWithData(privateSticks || [])
          return { sticks: enrichedSticks }
        },
        { ttl: 30, staleWhileRevalidate: 60, tags: [`social-sticks-${user.id}-${orgContext.orgId}`] },
      )
    }

    if (isAdmin) {
      if (!user) {
        return createUnauthorizedResponse()
      }

      const isUserAdmin = user.email && ADMIN_EMAILS.includes(user.email)

      if (!isUserAdmin) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }

      const { data: allSticks, error } = await supabase
        .from("social_sticks")
        .select(`
          *,
          social_pads(id, name)
        `)
        .order("created_at", { ascending: false })

      if (error) throw error

      const enrichedSticks = await enrichSticksWithData(allSticks || [])
      return NextResponse.json({ sticks: enrichedSticks })
    }

    if (!user) {
      return NextResponse.json({ error: "Unauthorized", details: "Authentication required" }, { status: 401 })
    }

    if (!orgContext) {
      console.warn("[v0] No org context for user, falling back to public sticks only:", user.email)

      const { data: publicSticks, error } = await supabase
        .from("social_sticks")
        .select(`
          *,
          social_pads!inner(id, name, is_public)
        `)
        .eq("social_pads.is_public", true)
        .order("created_at", { ascending: false })

      if (error) {
        console.error("[v0] Error fetching public sticks fallback:", error)
        return NextResponse.json({ sticks: [] })
      }

      const enrichedSticks = await enrichSticksWithData(publicSticks || [])
      return NextResponse.json({ sticks: enrichedSticks })
    }

    const url = new URL(request.url)
    const cacheInvalidation = url.searchParams.get("_t")

    const authenticatedUser = user
    const validOrgContext = orgContext

    const cacheKey = APICache.getCacheKey("social-sticks", {
      userId: authenticatedUser.id,
      orgId: validOrgContext.orgId,
    })

    if (cacheInvalidation) {
      await APICache.invalidate(cacheKey)
    }

    return withCache(
      cacheKey,
      async () => {
        const { data: ownedPads } = await supabase
          .from("social_pads")
          .select("id")
          .eq("owner_id", authenticatedUser.id)
          .eq("org_id", validOrgContext.orgId)

        const { data: memberPadIds } = await supabase
          .from("social_pad_members")
          .select("social_pad_id")
          .eq("user_id", authenticatedUser.id)
          .eq("org_id", validOrgContext.orgId)
          .eq("accepted", true)

        const { data: publicPads } = await supabase.from("social_pads").select("id").eq("is_public", true)

        const accessiblePadIds = [
          ...(ownedPads?.map((p) => p.id) || []),
          ...(memberPadIds?.map((m) => m.social_pad_id) || []),
          ...(publicPads?.map((p) => p.id) || []),
        ]

        const uniquePadIds = [...new Set(accessiblePadIds)]

        if (uniquePadIds.length === 0) {
          return { sticks: [] }
        }

        const { data: sticks, error } = await supabase
          .from("social_sticks")
          .select(`
            *,
            social_pads(id, name, is_public, owner_id)
          `)
          .in("social_pad_id", uniquePadIds)
          .order("created_at", { ascending: false })

        if (error) {
          console.error("[v0] Error fetching sticks:", error)
          throw error
        }

        const enrichedSticks = await enrichSticksWithData(sticks || [])
        return { sticks: enrichedSticks }
      },
      { ttl: 30, staleWhileRevalidate: 60, tags: [`social-sticks-${user.id}-${orgContext.orgId}`] },
    )
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    if (errorMessage.includes("Too Many") || errorMessage.includes("429") || errorMessage.includes("RATE_LIMITED")) {
      return NextResponse.json(
        { error: "Too many requests. Please try again in a moment." },
        { status: 429, headers: { "Retry-After": "5" } },
      )
    }
    console.error("[v0] Error fetching social sticks:", error)
    return NextResponse.json({ error: "Failed to fetch social sticks" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { user, error: authError } = await getCachedAuthUser()

    if (authError === "rate_limited") {
      return createRateLimitResponse()
    }

    if (!user) {
      return createUnauthorizedResponse()
    }

    const supabase = await createClient()

    const orgContext = await getOrgContext()
    if (!orgContext) {
      return NextResponse.json({ error: "No organization context" }, { status: 403 })
    }

    const { topic, content, social_pad_id, color } = await request.json()

    if (!topic?.trim() || !social_pad_id) {
      return NextResponse.json({ error: "Topic and pad are required" }, { status: 400 })
    }

    const { data: membership } = await supabase
      .from("social_pad_members")
      .select("role")
      .eq("social_pad_id", social_pad_id)
      .eq("user_id", user.id)
      .eq("org_id", orgContext.orgId)
      .eq("accepted", true)
      .maybeSingle()

    const { data: pad } = await supabase
      .from("social_pads")
      .select("owner_id, org_id")
      .eq("id", social_pad_id)
      .maybeSingle()

    if (!membership && pad?.owner_id !== user.id) {
      return NextResponse.json({ error: "You don't have access to this pad" }, { status: 403 })
    }

    const { data: stick, error } = await supabase
      .from("social_sticks")
      .insert({
        topic: topic.trim(),
        content: content?.trim() || "",
        social_pad_id,
        user_id: user.id,
        org_id: pad?.org_id || orgContext.orgId,
        color: color || "#fef3c7",
      })
      .select()
      .single()

    if (error) throw error

    await APICache.invalidate(`social-sticks:userId=${user.id}:orgId=${orgContext.orgId}`)
    await APICache.invalidate(`social-sticks:public=true`)

    return NextResponse.json({ stick })
  } catch (error) {
    console.error("Error creating social stick:", error)
    return NextResponse.json({ error: "Failed to create social stick" }, { status: 500 })
  }
}

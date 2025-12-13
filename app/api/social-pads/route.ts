import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { APICache, withCache } from "@/lib/api-cache"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

const ADMIN_EMAILS = ["chrisdoran63@outlook.com"]

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const isPublic = searchParams.get("public") === "true"
    const isAdmin = searchParams.get("admin") === "true"
    const isPrivate = searchParams.get("private") === "true"

    const supabase = await createClient()
    const authResult = await getCachedAuthUser(supabase)

    if (authResult.rateLimited) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again in a moment." },
        { status: 429, headers: { "Retry-After": "30" } },
      )
    }

    const user = authResult.user
    const orgContext = user ? await getOrgContext() : null

    if (isPublic) {
      const cacheKey = APICache.getCacheKey("social-pads", { public: true })

      return withCache(
        cacheKey,
        async () => {
          const { data: publicPads, error } = await supabase
            .from("social_pads")
            .select("*, org_id")
            .eq("is_public", true)
            .order("created_at", { ascending: false })

          if (error) throw error
          return { pads: publicPads || [] }
        },
        { ttl: 60, staleWhileRevalidate: 300 },
      )
    }

    if (isPrivate) {
      if (!user || !orgContext) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }

      const cacheKey = APICache.getCacheKey("social-pads", { private: true, userId: user.id, orgId: orgContext.orgId })

      return withCache(
        cacheKey,
        async () => {
          const { data: ownedPrivatePads, error: ownedError } = await supabase
            .from("social_pads")
            .select("*, org_id")
            .eq("owner_id", user.id)
            .eq("org_id", orgContext.orgId)
            .eq("is_public", false)
            .order("created_at", { ascending: false })

          const { data: memberPrivatePads, error: memberError } = await supabase
            .from("social_pads")
            .select("*, org_id, social_pad_members!inner(role, user_id)")
            .eq("social_pad_members.user_id", user.id)
            .eq("social_pad_members.accepted", true)
            .eq("org_id", orgContext.orgId)
            .eq("is_public", false)
            .neq("owner_id", user.id)
            .order("created_at", { ascending: false })

          if (ownedError) throw ownedError
          if (memberError) throw memberError

          const allPrivatePads = [...(ownedPrivatePads || []), ...(memberPrivatePads || [])]

          return { pads: allPrivatePads }
        },
        { ttl: 30, staleWhileRevalidate: 60, tags: [`social-pads-${user.id}-${orgContext.orgId}`] },
      )
    }

    if (isAdmin) {
      if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }

      const isUserAdmin = user.email && ADMIN_EMAILS.includes(user.email)

      if (!isUserAdmin) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }

      const { data: allPads, error } = await supabase
        .from("social_pads")
        .select("*, org_id")
        .order("created_at", { ascending: false })

      if (error) throw error
      return NextResponse.json({ pads: allPads || [] })
    }

    if (!user || !orgContext) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const cacheKey = APICache.getCacheKey("social-pads", { userId: user.id, orgId: orgContext.orgId })

    return withCache(
      cacheKey,
      async () => {
        const { data: ownedPads, error: ownedError } = await supabase
          .from("social_pads")
          .select("*, org_id")
          .eq("owner_id", user.id)
          .eq("org_id", orgContext.orgId)
          .order("created_at", { ascending: false })

        if (ownedError) throw ownedError

        const { data: memberPads, error: memberError } = await supabase
          .from("social_pads")
          .select("*, org_id, social_pad_members!inner(role, user_id)")
          .eq("social_pad_members.user_id", user.id)
          .eq("social_pad_members.accepted", true)
          .eq("org_id", orgContext.orgId)
          .neq("owner_id", user.id)
          .order("created_at", { ascending: false })

        if (memberError) throw memberError

        const allPads = [...(ownedPads || []), ...(memberPads || [])]
        const uniquePads = Array.from(new Map(allPads.map((pad) => [pad.id, pad])).values())

        return { pads: uniquePads }
      },
      { ttl: 30, staleWhileRevalidate: 60, tags: [`social-pads-${user.id}-${orgContext.orgId}`] },
    )
  } catch (error) {
    console.error("Error fetching social pads:", error)
    return NextResponse.json({ error: "Failed to fetch social pads" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const authResult = await getCachedAuthUser(supabase)

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

    const orgContext = await getOrgContext()
    if (!orgContext) {
      return NextResponse.json({ error: "No organization context" }, { status: 403 })
    }

    const { name, description, is_public, category_id, hub_type, hub_email, access_mode, home_code } =
      await request.json()

    if (!name?.trim()) {
      return NextResponse.json({ error: "Pad name is required" }, { status: 400 })
    }

    const insertData: any = {
      name: name.trim(),
      description: description?.trim() || null,
      owner_id: user.id,
      org_id: orgContext.orgId,
      is_public: is_public || false,
      category_id: category_id || null,
      hub_type: hub_type || null,
      hub_email: hub_email || null,
    }

    if (home_code) {
      insertData.home_code = home_code.trim()
    }

    if (access_mode) {
      insertData.access_mode = access_mode
    }

    const { data: pad, error: padError } = await supabase.from("social_pads").insert(insertData).select().maybeSingle()

    if (padError || !pad) {
      console.error("[v0] Error creating pad:", padError)
      throw padError || new Error("Failed to create pad")
    }

    const { error: memberError } = await supabase.from("social_pad_members").insert({
      social_pad_id: pad.id,
      user_id: user.id,
      org_id: orgContext.orgId,
      role: "editor",
      accepted: true,
      invited_by: user.id,
      admin_level: "owner",
    })

    if (memberError) {
      console.error("[v0] Error adding member:", memberError)
      await supabase.from("social_pads").delete().eq("id", pad.id)
      throw memberError
    }

    await APICache.invalidate(`social-pads:userId=${user.id}:orgId=${orgContext.orgId}`)
    await APICache.invalidate(`social-pads:public=true`)

    return NextResponse.json({ pad })
  } catch (error: any) {
    console.error("[v0] Error creating social pad:", error)
    return NextResponse.json({ error: error?.message || "Failed to create social pad" }, { status: 500 })
  }
}

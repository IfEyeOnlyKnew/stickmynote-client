import { createClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    const { user, error: authError, rateLimited } = await getCachedAuthUser(supabase)

    if (rateLimited) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 })
    }

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = Number.parseInt(searchParams.get("page") || "0")
    const limit = Number.parseInt(searchParams.get("limit") || "10")
    const search = searchParams.get("search") || ""

    console.log("[v0] GET /api/user/accessible-pads - Query params:", { page, limit, search })
    console.log("[v0] GET /api/user/accessible-pads - Fetching pads with left join on multi_paks")

    let query = supabase
      .from("paks_pads")
      .select(`
        id,
        name,
        created_at,
        owner_id,
        multi_pak_id,
        multi_paks!left(name)
      `)
      .or(`owner_id.eq.${user.id},id.in.(select pad_id from paks_pad_members where user_id.eq.${user.id})`)
      .order("created_at", { ascending: false })
      .range(page * limit, (page + 1) * limit - 1)

    if (search) {
      query = query.ilike("name", `%${search}%`)
    }

    const { data: pads, error } = await query

    if (error) {
      console.error("[v0] GET /api/user/accessible-pads - Error fetching pads:", error)
      console.error("[v0] GET /api/user/accessible-pads - Error code:", error.code)
      console.error("[v0] GET /api/user/accessible-pads - Error message:", error.message)
      return NextResponse.json({ error: "Failed to fetch pads" }, { status: 500 })
    }

    console.log("[v0] GET /api/user/accessible-pads - Successfully fetched", pads?.length || 0, "pads")

    const formattedPads =
      pads?.map((pad: any) => ({
        id: pad.id,
        name: pad.name,
        isOwner: pad.owner_id === user.id,
        multiPakName: pad.multi_paks?.name || null,
        href: `/pads/${pad.id}`,
      })) || []

    return NextResponse.json({
      pads: formattedPads,
      hasMore: pads?.length === limit,
    })
  } catch (error) {
    console.error("[v0] GET /api/user/accessible-pads - Unexpected error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

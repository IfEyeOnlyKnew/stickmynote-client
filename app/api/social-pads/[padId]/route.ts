import { createDatabaseClient } from "@/lib/database/database-adapter"
import { type NextRequest, NextResponse } from "next/server"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

export async function GET(request: NextRequest, { params }: { params: Promise<{ padId: string }> }) {
  try {
    const db = await createDatabaseClient()
    const { padId } = await params

    const orgContext = await getOrgContext()

    // Build pad query - use simple select without Supabase-style joins
    let padQuery = db.from("social_pads").select("*").eq("id", padId)

    // Filter by org_id if user is authenticated
    if (orgContext) {
      padQuery = padQuery.eq("org_id", orgContext.orgId)
    }

    const { data: pad, error: padError } = await padQuery.maybeSingle()

    if (padError || !pad) {
      return NextResponse.json({ error: "Pad not found" }, { status: 404 })
    }

    // Get member count separately
    const { data: memberCount } = await db
      .from("social_pad_members")
      .select("id")
      .eq("social_pad_id", padId)
      .eq("accepted", true)

    const { data: owner } = await db.from("users").select("email, full_name").eq("id", pad.owner_id).maybeSingle()

    // Check if user has access (public pads are accessible to everyone)
    const authResult = await getCachedAuthUser()

    if (authResult.rateLimited) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again in a moment." },
        { status: 429, headers: { "Retry-After": "30" } },
      )
    }

    const user = authResult.user

    if (!pad.is_public) {
      if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }

      const { data: membership } = await db
        .from("social_pad_members")
        .select("*")
        .eq("social_pad_id", padId)
        .eq("user_id", user.id)
        .eq("accepted", true)
        .maybeSingle()

      if (pad.owner_id !== user.id && !membership) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
    }

    // Build sticks query - use simple select without Supabase-style joins
    let sticksQuery = db
      .from("social_sticks")
      .select("*")
      .eq("social_pad_id", padId)
      .order("created_at", { ascending: false })

    if (orgContext) {
      sticksQuery = sticksQuery.eq("org_id", orgContext.orgId)
    }

    const { data: sticks, error: sticksError } = await sticksQuery

    if (sticksError) {
      console.error("Error fetching sticks:", sticksError)
    }

    // Get reply counts for all sticks
    const stickIds = (sticks || []).map((s: any) => s.id)
    let replyCountMap = new Map<string, number>()

    if (stickIds.length > 0) {
      const { data: replies } = await db
        .from("social_stick_replies")
        .select("social_stick_id")
        .in("social_stick_id", stickIds)

      for (const reply of replies || []) {
        const count = replyCountMap.get(reply.social_stick_id) || 0
        replyCountMap.set(reply.social_stick_id, count + 1)
      }
    }

    const sticksWithUsers = await Promise.all(
      (sticks || []).map(async (stick: any) => {
        const { data: stickUser } = await db
          .from("users")
          .select("email, full_name")
          .eq("id", stick.user_id)
          .maybeSingle()

        return {
          ...stick,
          user: stickUser || null,
          reply_count: replyCountMap.get(stick.id) || 0,
        }
      }),
    )

    return NextResponse.json({
      pad: {
        ...pad,
        owner: owner || null,
        member_count: memberCount?.length || 0,
      },
      sticks: sticksWithUsers,
    })
  } catch (error) {
    console.error("Error in GET /api/social-pads/[padId]:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ padId: string }> }) {
  try {
    const db = await createDatabaseClient()
    const { padId } = await params
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

    const orgContext = await getOrgContext()
    if (!orgContext) {
      return NextResponse.json({ error: "Organization context required" }, { status: 401 })
    }

    const { name, description, is_public } = await request.json()

    const { data: pad } = await db
      .from("social_pads")
      .select("owner_id")
      .eq("id", padId)
      .eq("org_id", orgContext.orgId)
      .maybeSingle()

    if (!pad || pad.owner_id !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    const { data: updatedPad, error } = await db
      .from("social_pads")
      .update({
        name,
        description,
        is_public,
        updated_at: new Date().toISOString(),
      })
      .eq("id", padId)
      .eq("org_id", orgContext.orgId)
      .select()
      .maybeSingle()

    if (error) {
      console.error("Error updating pad:", error)
      return NextResponse.json({ error: "Failed to update pad" }, { status: 500 })
    }

    return NextResponse.json({ pad: updatedPad })
  } catch (error) {
    console.error("Error in PATCH /api/social-pads/[padId]:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

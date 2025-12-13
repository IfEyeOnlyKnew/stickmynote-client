import { createClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

export async function GET(request: NextRequest, { params }: { params: { padId: string } }) {
  try {
    const supabase = await createClient()
    const { padId } = params

    const orgContext = await getOrgContext()

    const padQuery = supabase.from("social_pads").select("*, social_pad_members(count)").eq("id", padId)

    // Filter by org_id if user is authenticated
    if (orgContext) {
      padQuery.eq("org_id", orgContext.orgId)
    }

    const { data: pad, error: padError } = await padQuery.maybeSingle()

    if (padError || !pad) {
      return NextResponse.json({ error: "Pad not found" }, { status: 404 })
    }

    const { data: owner } = await supabase.from("users").select("email, full_name").eq("id", pad.owner_id).maybeSingle()

    // Check if user has access (public pads are accessible to everyone)
    const authResult = await getCachedAuthUser(supabase)

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

      const { data: membership } = await supabase
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

    const sticksQuery = supabase
      .from("social_sticks")
      .select("*, social_stick_replies(count)")
      .eq("social_pad_id", padId)
      .order("created_at", { ascending: false })

    if (orgContext) {
      sticksQuery.eq("org_id", orgContext.orgId)
    }

    const { data: sticks, error: sticksError } = await sticksQuery

    if (sticksError) {
      console.error("Error fetching sticks:", sticksError)
    }

    const sticksWithUsers = await Promise.all(
      (sticks || []).map(async (stick) => {
        const { data: stickUser } = await supabase
          .from("users")
          .select("email, full_name")
          .eq("id", stick.user_id)
          .maybeSingle()

        return {
          ...stick,
          user: stickUser || null,
        }
      }),
    )

    return NextResponse.json({
      pad: {
        ...pad,
        owner: owner || null,
      },
      sticks: sticksWithUsers,
    })
  } catch (error) {
    console.error("Error in GET /api/social-pads/[padId]:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { padId: string } }) {
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
      return NextResponse.json({ error: "Organization context required" }, { status: 401 })
    }

    const { name, description, is_public } = await request.json()
    const { padId } = params

    const { data: pad } = await supabase
      .from("social_pads")
      .select("owner_id")
      .eq("id", padId)
      .eq("org_id", orgContext.orgId)
      .maybeSingle()

    if (!pad || pad.owner_id !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    const { data: updatedPad, error } = await supabase
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

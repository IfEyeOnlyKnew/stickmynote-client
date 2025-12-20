import { createDatabaseClient } from "@/lib/database/database-adapter"
import { NextResponse } from "next/server"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from "@/lib/auth/cached-auth"

export async function POST(request: Request, { params }: { params: { stickId: string } }) {
  try {
    const db = await createDatabaseClient()
    const authResult = await getCachedAuthUser()

    if (authResult.rateLimited) {
      return createRateLimitResponse()
    }

    if (!authResult.user) {
      return createUnauthorizedResponse()
    }

    const user = authResult.user
    const orgContext = await getOrgContext(user.id)
    if (!orgContext) {
      return NextResponse.json({ error: "No organization context" }, { status: 403 })
    }

    const { stickId } = params

    const { data: stick } = await db
      .from("social_sticks")
      .select("social_pad_id, is_pinned, social_pads(owner_id)")
      .eq("id", stickId)
      .eq("org_id", orgContext.orgId)
      .maybeSingle()

    if (!stick) {
      return NextResponse.json({ error: "Stick not found" }, { status: 404 })
    }

    const padInfo = Array.isArray(stick.social_pads) ? stick.social_pads[0] : stick.social_pads
    const padOwnerId = padInfo?.owner_id

    const { data: membership } = await db
      .from("social_pad_members")
      .select("role")
      .eq("social_pad_id", stick.social_pad_id)
      .eq("user_id", user.id)
      .eq("accepted", true)
      .eq("org_id", orgContext.orgId)
      .maybeSingle()

    const canPin = padOwnerId === user.id || membership?.role === "admin"

    if (!canPin) {
      return NextResponse.json({ error: "Only pad owners and admins can pin sticks" }, { status: 403 })
    }

    const { data: pinnedSticks } = await db
      .from("social_sticks")
      .select("pin_order")
      .eq("social_pad_id", stick.social_pad_id)
      .eq("is_pinned", true)
      .eq("org_id", orgContext.orgId)
      .order("pin_order", { ascending: false })
      .limit(1)

    const nextPinOrder = pinnedSticks && pinnedSticks.length > 0 ? (pinnedSticks[0].pin_order || 0) + 1 : 1

    const { data: updatedStick, error } = await db
      .from("social_sticks")
      .update({
        is_pinned: !stick.is_pinned,
        pinned_at: !stick.is_pinned ? new Date().toISOString() : null,
        pinned_by: !stick.is_pinned ? user.id : null,
        pin_order: !stick.is_pinned ? nextPinOrder : null,
      })
      .eq("id", stickId)
      .eq("org_id", orgContext.orgId)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ stick: updatedStick })
  } catch (error) {
    console.error("Error toggling pin:", error)
    return NextResponse.json({ error: "Failed to pin/unpin stick" }, { status: 500 })
  }
}

export async function PUT(request: Request, { params }: { params: { stickId: string } }) {
  try {
    const db = await createDatabaseClient()
    const authResult = await getCachedAuthUser()

    if (authResult.rateLimited) {
      return createRateLimitResponse()
    }

    if (!authResult.user) {
      return createUnauthorizedResponse()
    }

    const user = authResult.user
    const orgContext = await getOrgContext(user.id)
    if (!orgContext) {
      return NextResponse.json({ error: "No organization context" }, { status: 403 })
    }

    const { stickId } = params
    const { pin_order } = await request.json()

    const { data: stick } = await db
      .from("social_sticks")
      .select("social_pad_id, is_pinned, social_pads(owner_id)")
      .eq("id", stickId)
      .eq("org_id", orgContext.orgId)
      .maybeSingle()

    if (!stick || !stick.is_pinned) {
      return NextResponse.json({ error: "Stick not found or not pinned" }, { status: 404 })
    }

    const padInfo = Array.isArray(stick.social_pads) ? stick.social_pads[0] : stick.social_pads
    const padOwnerId = padInfo?.owner_id

    const { data: membership } = await db
      .from("social_pad_members")
      .select("role")
      .eq("social_pad_id", stick.social_pad_id)
      .eq("user_id", user.id)
      .eq("accepted", true)
      .eq("org_id", orgContext.orgId)
      .maybeSingle()

    const canReorder = padOwnerId === user.id || membership?.role === "admin"

    if (!canReorder) {
      return NextResponse.json({ error: "Only pad owners and admins can reorder pinned sticks" }, { status: 403 })
    }

    const { data: updatedStick, error } = await db
      .from("social_sticks")
      .update({ pin_order })
      .eq("id", stickId)
      .eq("org_id", orgContext.orgId)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ stick: updatedStick })
  } catch (error) {
    console.error("Error reordering pinned stick:", error)
    return NextResponse.json({ error: "Failed to reorder pinned stick" }, { status: 500 })
  }
}

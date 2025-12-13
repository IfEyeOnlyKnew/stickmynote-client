import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service-client"
import { NextResponse } from "next/server"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from "@/lib/auth/cached-auth"

type User = {
  id: string
  full_name: string | null
  username: string | null
  email: string | null
  avatar_url: string | null
}

export async function GET(request: Request, { params }: { params: { stickId: string } }) {
  try {
    const supabase = await createClient()
    const authResult = await getCachedAuthUser(supabase)

    if (authResult.rateLimited) {
      return createRateLimitResponse()
    }

    if (!authResult.user) {
      return createUnauthorizedResponse()
    }

    const user = authResult.user

    let orgContext
    try {
      orgContext = await getOrgContext()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      if (errorMessage === "RATE_LIMITED") {
        return createRateLimitResponse()
      }
      throw err
    }

    if (!orgContext) {
      return NextResponse.json({ error: "Organization context required" }, { status: 401 })
    }

    const { stickId } = params

    const { data: stick, error: stickError } = await supabase
      .from("social_sticks")
      .select(`
        *,
        social_pads(id, name, owner_id)
      `)
      .eq("id", stickId)
      .eq("org_id", orgContext.orgId)
      .maybeSingle()

    if (stickError) throw stickError
    if (!stick) {
      return NextResponse.json({ error: "Stick not found" }, { status: 404 })
    }

    const padInfo = Array.isArray(stick.social_pads) ? stick.social_pads[0] : stick.social_pads
    const padId = padInfo?.id || stick.social_pad_id
    const padOwnerId = padInfo?.owner_id

    if (!padId) {
      return NextResponse.json({ error: "Invalid stick data" }, { status: 500 })
    }

    const { data: membership } = await supabase
      .from("social_pad_members")
      .select("role")
      .eq("social_pad_id", padId)
      .eq("user_id", user.id)
      .eq("accepted", true)
      .eq("org_id", orgContext.orgId)
      .maybeSingle()

    if (!membership && padOwnerId !== user.id) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    const { data: detailsTab } = await supabase
      .from("social_stick_tabs")
      .select("tab_data")
      .eq("social_stick_id", stickId)
      .eq("tab_type", "details")
      .eq("org_id", orgContext.orgId)
      .maybeSingle()

    const details = detailsTab?.tab_data?.content || ""

    const { data: replies, error: repliesError } = await supabase
      .from("social_stick_replies")
      .select("*")
      .eq("social_stick_id", stickId)
      .eq("org_id", orgContext.orgId)
      .order("created_at", { ascending: true })

    if (repliesError) throw repliesError

    const userIds = [...new Set(replies?.map((r) => r.user_id) || [])]

    let usersMap: Record<string, User> = {}
    if (userIds.length > 0) {
      const serviceClient = createServiceClient()
      const { data: users } = await serviceClient
        .from("users")
        .select("id, full_name, username, email, avatar_url")
        .in("id", userIds)
        .returns<User[]>()

      if (users) {
        usersMap = users.reduce(
          (acc, u) => {
            acc[u.id] = u
            return acc
          },
          {} as Record<string, User>,
        )
      }
    }

    const repliesWithUsers =
      replies?.map((reply) => ({
        ...reply,
        users: usersMap[reply.user_id] || null,
      })) || []

    return NextResponse.json({ stick: { ...stick, details, replies: repliesWithUsers } })
  } catch (error) {
    console.error("Error fetching social stick:", error)
    return NextResponse.json({ error: "Failed to fetch social stick" }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: { params: { stickId: string } }) {
  try {
    const supabase = await createClient()
    const authResult = await getCachedAuthUser(supabase)

    if (authResult.rateLimited) {
      return createRateLimitResponse()
    }

    if (!authResult.user) {
      return createUnauthorizedResponse()
    }

    const user = authResult.user

    let orgContext
    try {
      orgContext = await getOrgContext()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      if (errorMessage === "RATE_LIMITED") {
        return createRateLimitResponse()
      }
      throw err
    }

    if (!orgContext) {
      return NextResponse.json({ error: "Organization context required" }, { status: 401 })
    }

    const { stickId } = params
    const updates = await request.json()

    const { data: stick } = await supabase
      .from("social_sticks")
      .select("user_id, social_pad_id, social_pads(owner_id)")
      .eq("id", stickId)
      .eq("org_id", orgContext.orgId)
      .maybeSingle()

    if (!stick) {
      return NextResponse.json({ error: "Stick not found" }, { status: 404 })
    }

    const padInfo = Array.isArray(stick.social_pads) ? stick.social_pads[0] : stick.social_pads
    const padOwnerId = padInfo?.owner_id

    const { data: membership } = await supabase
      .from("social_pad_members")
      .select("role")
      .eq("social_pad_id", stick.social_pad_id)
      .eq("user_id", user.id)
      .eq("accepted", true)
      .eq("org_id", orgContext.orgId)
      .maybeSingle()

    const canEdit =
      stick.user_id === user.id || padOwnerId === user.id || membership?.role === "admin" || membership?.role === "edit"

    if (!canEdit) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 })
    }

    const { data: updatedStick, error } = await supabase
      .from("social_sticks")
      .update(updates)
      .eq("id", stickId)
      .eq("org_id", orgContext.orgId)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ stick: updatedStick })
  } catch (error) {
    console.error("Error updating social stick:", error)
    return NextResponse.json({ error: "Failed to update social stick" }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: { stickId: string } }) {
  try {
    const supabase = await createClient()
    const authResult = await getCachedAuthUser(supabase)

    if (authResult.rateLimited) {
      return createRateLimitResponse()
    }

    if (!authResult.user) {
      return createUnauthorizedResponse()
    }

    const user = authResult.user

    let orgContext
    try {
      orgContext = await getOrgContext()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      if (errorMessage === "RATE_LIMITED") {
        return createRateLimitResponse()
      }
      throw err
    }

    if (!orgContext) {
      return NextResponse.json({ error: "Organization context required" }, { status: 401 })
    }

    const { stickId } = params

    const { data: stick } = await supabase
      .from("social_sticks")
      .select("user_id, social_pad_id, social_pads(owner_id)")
      .eq("id", stickId)
      .eq("org_id", orgContext.orgId)
      .maybeSingle()

    if (!stick) {
      return NextResponse.json({ error: "Stick not found" }, { status: 404 })
    }

    const padInfo = Array.isArray(stick.social_pads) ? stick.social_pads[0] : stick.social_pads
    const padOwnerId = padInfo?.owner_id

    const canDelete = stick.user_id === user.id || padOwnerId === user.id

    if (!canDelete) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 })
    }

    const { error } = await supabase.from("social_sticks").delete().eq("id", stickId).eq("org_id", orgContext.orgId)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting social stick:", error)
    return NextResponse.json({ error: "Failed to delete social stick" }, { status: 500 })
  }
}

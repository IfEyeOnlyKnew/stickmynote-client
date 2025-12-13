import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from "@/lib/auth/cached-auth"

export async function PUT(request: Request) {
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
    const orgContext = await getOrgContext(user.id)

    const { socialStickId, details } = await request.json()

    if (!socialStickId || details === undefined) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Get the stick to check permissions
    let stickQuery = supabase
      .from("social_sticks")
      .select("user_id, social_pad_id, social_pads(owner_id)")
      .eq("id", socialStickId)

    if (orgContext?.orgId) {
      stickQuery = stickQuery.eq("org_id", orgContext.orgId)
    }

    const { data: stick } = await stickQuery.maybeSingle()

    if (!stick) {
      return NextResponse.json({ error: "Stick not found" }, { status: 404 })
    }

    const padInfo = Array.isArray(stick.social_pads) ? stick.social_pads[0] : stick.social_pads
    const padOwnerId = padInfo?.owner_id

    // Check if user has edit permissions
    let membershipQuery = supabase
      .from("social_pad_members")
      .select("role")
      .eq("social_pad_id", stick.social_pad_id)
      .eq("user_id", user.id)
      .eq("accepted", true)

    if (orgContext?.orgId) {
      membershipQuery = membershipQuery.eq("org_id", orgContext.orgId)
    }

    const { data: membership } = await membershipQuery.maybeSingle()

    const canEdit =
      stick.user_id === user.id || padOwnerId === user.id || membership?.role === "admin" || membership?.role === "edit"

    if (!canEdit) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 })
    }

    // Check if details tab already exists
    let existingTabQuery = supabase
      .from("social_stick_tabs")
      .select("id")
      .eq("social_stick_id", socialStickId)
      .eq("tab_type", "details")

    if (orgContext?.orgId) {
      existingTabQuery = existingTabQuery.eq("org_id", orgContext.orgId)
    }

    const { data: existingTab } = await existingTabQuery.maybeSingle()

    let result
    if (existingTab) {
      // Update existing details tab
      let updateQuery = supabase
        .from("social_stick_tabs")
        .update({
          tab_data: { content: details },
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingTab.id)

      if (orgContext?.orgId) {
        updateQuery = updateQuery.eq("org_id", orgContext.orgId)
      }

      const { data, error } = await updateQuery.select().single()

      if (error) throw error
      result = data
    } else {
      const insertData: Record<string, unknown> = {
        social_stick_id: socialStickId,
        tab_type: "details",
        title: "Details",
        tab_data: { content: details },
        tab_order: 999,
      }

      if (orgContext?.orgId) {
        insertData.org_id = orgContext.orgId
      }

      const { data, error } = await supabase.from("social_stick_tabs").insert(insertData).select().single()

      if (error) throw error
      result = data
    }

    return NextResponse.json({ success: true, tab: result })
  } catch (error) {
    console.error("Error saving social stick details:", error)
    return NextResponse.json({ error: "Failed to save details" }, { status: 500 })
  }
}

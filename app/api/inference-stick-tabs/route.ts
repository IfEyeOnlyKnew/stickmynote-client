import { createDatabaseClient } from "@/lib/database/database-adapter"
import { NextResponse } from "next/server"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from "@/lib/auth/cached-auth"

interface StickInfo {
  user_id: string
  social_pad_id: string
  social_pads: { owner_id: string } | { owner_id: string }[] | null
}

function hasEditPermission(
  stick: StickInfo,
  userId: string,
  membership: { role: string } | null
): boolean {
  const padInfo = Array.isArray(stick.social_pads) ? stick.social_pads[0] : stick.social_pads
  const padOwnerId = padInfo?.owner_id
  const isOwnerOrAuthor = stick.user_id === userId || padOwnerId === userId
  const hasEditRole = membership?.role === "admin" || membership?.role === "edit"
  return isOwnerOrAuthor || hasEditRole
}

async function updateExistingTab(
  db: Awaited<ReturnType<typeof createDatabaseClient>>,
  tabId: string,
  details: string,
  orgId: string | undefined
) {
  let updateQuery = db
    .from("social_stick_tabs")
    .update({
      tab_data: { content: details },
      updated_at: new Date().toISOString(),
    })
    .eq("id", tabId)

  if (orgId) {
    updateQuery = updateQuery.eq("org_id", orgId)
  }

  const { data, error } = await updateQuery.select().single()
  if (error) throw error
  return data
}

async function insertNewTab(
  db: Awaited<ReturnType<typeof createDatabaseClient>>,
  inferenceStickId: string,
  details: string,
  orgId: string | undefined
) {
  const insertData: Record<string, unknown> = {
    social_stick_id: inferenceStickId,
    tab_type: "details",
    title: "Details",
    tab_data: { content: details },
    tab_order: 999,
  }

  if (orgId) {
    insertData.org_id = orgId
  }

  const { data, error } = await db.from("social_stick_tabs").insert(insertData).select().single()
  if (error) throw error
  return data
}

export async function PUT(request: Request) {
  try {
    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) return createRateLimitResponse()
    if (!authResult.user) return createUnauthorizedResponse()

    const user = authResult.user
    const orgContext = await getOrgContext()
    const { inferenceStickId, details } = await request.json()

    if (!inferenceStickId || details === undefined) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const db = await createDatabaseClient()
    const orgId = orgContext?.orgId

    // Get the stick to check permissions
    let stickQuery = db
      .from("social_sticks")
      .select("user_id, social_pad_id")
      .eq("id", inferenceStickId)

    if (orgId) stickQuery = stickQuery.eq("org_id", orgId)

    const { data: stick } = await stickQuery.maybeSingle()
    if (!stick) {
      return NextResponse.json({ error: "Stick not found" }, { status: 404 })
    }

    // Fetch pad owner separately
    if (stick.social_pad_id) {
      const { data: pad } = await db
        .from("social_pads")
        .select("owner_id")
        .eq("id", stick.social_pad_id)
        .maybeSingle()
      stick.social_pads = pad
    }

    // Check membership
    let membershipQuery = db
      .from("social_pad_members")
      .select("role")
      .eq("social_pad_id", stick.social_pad_id)
      .eq("user_id", user.id)
      .eq("accepted", true)

    if (orgId) membershipQuery = membershipQuery.eq("org_id", orgId)

    const { data: membership } = await membershipQuery.maybeSingle()

    if (!hasEditPermission(stick, user.id, membership)) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 })
    }

    // Check if details tab already exists
    let existingTabQuery = db
      .from("social_stick_tabs")
      .select("id")
      .eq("social_stick_id", inferenceStickId)
      .eq("tab_type", "details")

    if (orgId) existingTabQuery = existingTabQuery.eq("org_id", orgId)

    const { data: existingTab } = await existingTabQuery.maybeSingle()

    const result = existingTab
      ? await updateExistingTab(db, existingTab.id, details, orgId)
      : await insertNewTab(db, inferenceStickId, details, orgId)

    return NextResponse.json({ success: true, tab: result })
  } catch (error) {
    console.error("Error saving social stick details:", error)
    return NextResponse.json({ error: "Failed to save details" }, { status: 500 })
  }
}

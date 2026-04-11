import { type NextRequest, NextResponse } from "next/server"
import { createServiceDatabaseClient } from "@/lib/database/database-adapter"
import { validateUUID } from "@/lib/input-validation-enhanced"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from "@/lib/auth/cached-auth"
import {
  type DbTabType,
  getTabName,
  getTabOrder,
  normalizeTabData,
  createTabItem,
} from "@/lib/handlers/stick-tabs-handler"

export const dynamic = "force-dynamic"

async function getAuthAndMembership(groupId: string, stickId: string) {
  const { user, error: authError } = await getCachedAuthUser()
  if (authError === "rate_limited") return { response: createRateLimitResponse() }
  if (!user) return { response: createUnauthorizedResponse() }

  const orgContext = await getOrgContext()
  if (!orgContext) {
    return { response: NextResponse.json({ error: "Organization context required" }, { status: 403 }) }
  }

  if (!validateUUID(groupId) || !validateUUID(stickId)) {
    return { response: NextResponse.json({ error: "Invalid ID" }, { status: 400 }) }
  }

  const db = await createServiceDatabaseClient()

  // Check group membership
  const { data: membership } = await db
    .from("concur_group_members")
    .select("role")
    .eq("group_id", groupId)
    .eq("user_id", user.id)
    .eq("org_id", orgContext.orgId)
    .maybeSingle()

  if (!membership) {
    return { response: NextResponse.json({ error: "Not a member of this group" }, { status: 403 }) }
  }

  // Verify stick belongs to this group
  const { data: stick } = await db
    .from("concur_sticks")
    .select("id, user_id, org_id")
    .eq("id", stickId)
    .eq("group_id", groupId)
    .maybeSingle()

  if (!stick) {
    return { response: NextResponse.json({ error: "Stick not found" }, { status: 404 }) }
  }

  return { user, orgContext, db, membership, stick }
}

// ============================================================================
// GET /api/concur/groups/[groupId]/sticks/[stickId]/tabs
// ============================================================================

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ groupId: string; stickId: string }> }
) {
  try {
    const params = await context.params
    const auth = await getAuthAndMembership(params.groupId, params.stickId)
    if ("response" in auth) return auth.response

    const { user, orgContext, db } = auth

    const { data, error } = await db
      .from("concur_stick_tabs")
      .select("id, stick_id, tab_name, tab_type, tab_content, tab_data, tab_order, created_at, updated_at, org_id")
      .eq("stick_id", params.stickId)
      .eq("org_id", orgContext.orgId)
      .order("tab_order", { ascending: true })

    if (error) {
      console.error("Error fetching concur stick tabs:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    let normalized = (data || []).map((row: any) => ({
      ...row,
      tab_data: normalizeTabData(row.tab_data),
    }))

    // Auto-create default tabs if none exist
    if (normalized.length === 0) {
      const defaultMain = {
        stick_id: params.stickId,
        user_id: user.id,
        org_id: orgContext.orgId,
        tab_name: "Main",
        tab_type: "main" as DbTabType,
        tab_content: "",
        tab_data: {},
        tab_order: 0,
      }

      const { data: mainTab, error: mainError } = await db
        .from("concur_stick_tabs")
        .insert(defaultMain)
        .select("id, stick_id, tab_name, tab_type, tab_content, tab_data, tab_order, created_at, updated_at, org_id")
        .single()

      if (mainError) {
        console.error("Error creating default main tab:", mainError)
      }

      const defaultDetails = {
        stick_id: params.stickId,
        user_id: user.id,
        org_id: orgContext.orgId,
        tab_name: "Details",
        tab_type: "details" as DbTabType,
        tab_content: "",
        tab_data: {},
        tab_order: 1,
      }

      const { data: detailsTab, error: detailsError } = await db
        .from("concur_stick_tabs")
        .insert(defaultDetails)
        .select("id, stick_id, tab_name, tab_type, tab_content, tab_data, tab_order, created_at, updated_at, org_id")
        .single()

      if (detailsError) {
        console.error("Error creating default details tab:", detailsError)
      }

      const created = [mainTab, detailsTab].filter(Boolean)
      normalized = created.map((row: any) => ({
        ...row,
        tab_data: normalizeTabData(row.tab_data),
      }))
    }

    return NextResponse.json({ tabs: normalized })
  } catch (err: any) {
    console.error("GET concur stick tabs error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// ============================================================================
// POST /api/concur/groups/[groupId]/sticks/[stickId]/tabs
// ============================================================================

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ groupId: string; stickId: string }> }
) {
  try {
    const params = await context.params
    const auth = await getAuthAndMembership(params.groupId, params.stickId)
    if ("response" in auth) return auth.response

    const { user, orgContext, db } = auth

    const body = await request.json()
    const { tab_type, type, url, title, thumbnail, metadata } = body

    const { data: existingTab } = await db
      .from("concur_stick_tabs")
      .select("id, tab_data")
      .eq("stick_id", params.stickId)
      .eq("tab_type", tab_type)
      .eq("org_id", orgContext.orgId)
      .maybeSingle()

    const tabData = normalizeTabData(existingTab?.tab_data || {})

    const newItem = createTabItem(tab_type, url, title, type, thumbnail, metadata)
    if (newItem) {
      const key = newItem.key as keyof typeof tabData
      const currentItems = (tabData[key] as any[]) || []
      ;(tabData as any)[key] = [...currentItems, newItem.item]
    }

    if (existingTab) {
      const { data: updatedTab, error } = await db
        .from("concur_stick_tabs")
        .update({
          tab_data: tabData,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingTab.id)
        .eq("org_id", orgContext.orgId)
        .select()
        .single()

      if (error) {
        console.error("Error updating concur stick tab:", error)
        return NextResponse.json({ error: "Failed to update tab" }, { status: 500 })
      }

      return NextResponse.json({ tab: updatedTab })
    } else {
      const { data: newTab, error } = await db
        .from("concur_stick_tabs")
        .insert({
          stick_id: params.stickId,
          user_id: user.id,
          org_id: orgContext.orgId,
          tab_name: getTabName(tab_type),
          tab_type,
          tab_content: "",
          tab_data: tabData,
          tab_order: getTabOrder(tab_type),
        })
        .select()
        .single()

      if (error) {
        console.error("Error creating concur stick tab:", error)
        return NextResponse.json({ error: "Failed to create tab" }, { status: 500 })
      }

      return NextResponse.json({ tab: newTab })
    }
  } catch (err: any) {
    console.error("POST concur stick tabs error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// ============================================================================
// PUT /api/concur/groups/[groupId]/sticks/[stickId]/tabs
// ============================================================================

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ groupId: string; stickId: string }> }
) {
  try {
    const params = await context.params
    const auth = await getAuthAndMembership(params.groupId, params.stickId)
    if ("response" in auth) return auth.response

    const { user, orgContext, db } = auth

    const body = await request.json()
    const { tab_type, tab_data } = body

    const { data: existingTab } = await db
      .from("concur_stick_tabs")
      .select("id, tab_data")
      .eq("stick_id", params.stickId)
      .eq("tab_type", tab_type)
      .eq("org_id", orgContext.orgId)
      .maybeSingle()

    if (existingTab) {
      const { data: updatedTab, error } = await db
        .from("concur_stick_tabs")
        .update({
          tab_data: normalizeTabData(tab_data),
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingTab.id)
        .eq("org_id", orgContext.orgId)
        .select("id, stick_id, tab_name, tab_type, tab_content, tab_data, tab_order, created_at, updated_at, org_id")
        .single()

      if (error) {
        console.error("Error updating concur stick tab:", error)
        return NextResponse.json({ error: "Failed to update tab" }, { status: 500 })
      }

      return NextResponse.json({ tab: { ...updatedTab, tab_data: normalizeTabData(updatedTab.tab_data) } })
    } else {
      const { data: newTab, error } = await db
        .from("concur_stick_tabs")
        .insert({
          stick_id: params.stickId,
          user_id: user.id,
          org_id: orgContext.orgId,
          tab_name: getTabName(tab_type),
          tab_type,
          tab_content: "",
          tab_data: normalizeTabData(tab_data),
          tab_order: getTabOrder(tab_type),
        })
        .select("id, stick_id, tab_name, tab_type, tab_content, tab_data, tab_order, created_at, updated_at, org_id")
        .single()

      if (error) {
        console.error("Error creating concur stick tab:", error)
        return NextResponse.json({ error: "Failed to create tab" }, { status: 500 })
      }

      return NextResponse.json({ tab: { ...newTab, tab_data: normalizeTabData(newTab.tab_data) } })
    }
  } catch (err: any) {
    console.error("PUT concur stick tabs error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

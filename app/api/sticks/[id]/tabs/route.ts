import { type NextRequest, NextResponse } from "next/server"
import { createServiceDatabaseClient } from "@/lib/database/database-adapter"
import type { DatabaseClient } from "@/lib/database/database-adapter"
import { validateUUID } from "@/lib/input-validation-enhanced"
import { applyRateLimit } from "@/lib/rate-limiter-enhanced"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from "@/lib/auth/cached-auth"
import {
  type StickTabRow,
  normalizeTabData,
  getTabName,
  getTabOrder,
  applyNewItemToTabData,
  getDefaultTabInserts,
  TAB_SELECT_COLUMNS,
} from "@/lib/handlers/stick-tabs-handler"

export const dynamic = "force-dynamic"

// Utilities
async function safeRateLimit(request: NextRequest, userId: string, action: string) {
  try {
    const res = await applyRateLimit(request, userId, action)
    return res.success
  } catch (err) {
    console.warn("Rate limit provider error, allowing request:", err)
    return true
  }
}

async function checkStickPermissions(
  db: DatabaseClient,
  stickId: string,
  userId: string,
  orgId: string,
  action: "read" | "write",
) {
  // Get stick and pad info - don't filter by org_id on stick lookup
  // as sticks may have different org_id than user's current context
  const { data: stick, error: stickError } = await db
    .from("paks_pad_sticks")
    .select("id, user_id, pad_id, org_id")
    .eq("id", stickId)
    .maybeSingle()

  if (stickError || !stick) {
    return { hasPermission: false, error: "Stick not found" }
  }

  // Check if user is stick owner
  if (stick.user_id === userId) {
    return { hasPermission: true, stick }
  }

  // Check pad permissions with org_id filter
  const { data: pad } = await db
    .from("paks_pads")
    .select("owner_id")
    .eq("id", stick.pad_id)
    .eq("org_id", orgId)
    .maybeSingle()

  // Check if user is pad owner
  if (pad?.owner_id === userId) {
    return { hasPermission: true, stick }
  }

  // Check pad membership
  const { data: membership } = await db
    .from("paks_pad_members")
    .select("role")
    .eq("pad_id", stick.pad_id)
    .eq("user_id", userId)
    .eq("accepted", true)
    .maybeSingle()

  if (membership) {
    if (action === "read") {
      // All members can read
      return { hasPermission: true, stick }
    } else {
      // Only admin and edit roles can write
      const canWrite = membership.role === "admin" || membership.role === "edit"
      return { hasPermission: canWrite, stick }
    }
  }

  return { hasPermission: false, error: "Permission denied" }
}

// GET /api/sticks/[id]/tabs
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { user, error: authError } = await getCachedAuthUser()

    if (authError === "rate_limited") {
      return createRateLimitResponse()
    }

    if (!user) {
      return createUnauthorizedResponse()
    }

    const db = await createServiceDatabaseClient()

    const orgContext = await getOrgContext()
    if (!orgContext) {
      return NextResponse.json({ error: "Organization context required" }, { status: 403 })
    }

    const params = await context.params
    const stickId = params.id
    if (!validateUUID(stickId)) {
      return NextResponse.json({ error: "Invalid Stick ID" }, { status: 400 })
    }

    if (!(await safeRateLimit(request, user.id, "stick_tabs_read"))) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 })
    }

    const { hasPermission, error: permError, stick } = await checkStickPermissions(
      db,
      stickId,
      user.id,
      orgContext.orgId,
      "read",
    )
    if (!hasPermission) {
      return NextResponse.json({ error: permError || "Permission denied" }, { status: 403 })
    }

    // Use the stick's org_id for fetching tabs, not user's current context
    const stickOrgId = stick?.org_id || orgContext.orgId

    const { data, error } = await db
      .from("paks_pad_stick_tabs")
      .select(TAB_SELECT_COLUMNS)
      .eq("stick_id", stickId)
      .eq("org_id", stickOrgId)
      .order("tab_order", { ascending: true })

    if (error) {
      console.error("Error fetching stick tabs:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    let normalized: StickTabRow[] = (data || []).map((row) => ({
      ...row,
      tab_data: normalizeTabData(row.tab_data),
    }))

    if (normalized.length === 0) {
      const defaultTabs = getDefaultTabInserts(stickId, user.id, stickOrgId)

      const { data: createdTabs, error: createError } = await db
        .from("paks_pad_stick_tabs")
        .insert(defaultTabs)
        .select(TAB_SELECT_COLUMNS)

      if (createError) {
        console.error("Error creating default tabs:", createError)
      } else {
        normalized = (createdTabs || []).map((row) => ({
          ...row,
          tab_data: normalizeTabData(row.tab_data),
        }))
      }
    }

    return NextResponse.json({ tabs: normalized })
  } catch (err: any) {
    console.error("GET /api/sticks/[id]/tabs error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST /api/sticks/[id]/tabs
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { user, error: authError } = await getCachedAuthUser()

    if (authError === "rate_limited") {
      return createRateLimitResponse()
    }

    if (!user) {
      return createUnauthorizedResponse()
    }

    const db = await createServiceDatabaseClient()

    const orgContext = await getOrgContext()
    if (!orgContext) {
      return NextResponse.json({ error: "Organization context required" }, { status: 403 })
    }

    const params = await context.params
    const stickId = params.id
    if (!validateUUID(stickId)) {
      return NextResponse.json({ error: "Invalid Stick ID" }, { status: 400 })
    }

    if (!(await safeRateLimit(request, user.id, "stick_tabs_write"))) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 })
    }

    const { hasPermission, error: permError, stick } = await checkStickPermissions(
      db,
      stickId,
      user.id,
      orgContext.orgId,
      "write",
    )
    if (!hasPermission) {
      return NextResponse.json({ error: permError || "Permission denied" }, { status: 403 })
    }

    // Use the stick's org_id for tab operations
    const stickOrgId = stick?.org_id || orgContext.orgId

    const body = await request.json()
    const { tab_type, type, url, title, thumbnail, metadata } = body

    const { data: existingTab } = await db
      .from("paks_pad_stick_tabs")
      .select("id, tab_data")
      .eq("stick_id", stickId)
      .eq("tab_type", tab_type)
      .eq("org_id", stickOrgId)
      .maybeSingle()

    const tabData = normalizeTabData(existingTab?.tab_data || {})

    // Add new item based on type using shared helper
    applyNewItemToTabData(tabData, { tab_type, type, url, title, thumbnail, metadata })

    if (existingTab) {
      const { data: updatedTab, error } = await db
        .from("paks_pad_stick_tabs")
        .update({
          tab_data: tabData,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingTab.id)
        .eq("org_id", stickOrgId)
        .select()
        .single()

      if (error) {
        console.error("Error updating stick tab:", error)
        return NextResponse.json({ error: "Failed to update tab" }, { status: 500 })
      }

      return NextResponse.json({ tab: updatedTab })
    } else {
      const { data: newTab, error } = await db
        .from("paks_pad_stick_tabs")
        .insert({
          stick_id: stickId,
          user_id: user.id,
          org_id: stickOrgId,
          tab_name: getTabName(tab_type),
          tab_type,
          tab_content: "",
          tab_data: tabData,
          tab_order: getTabOrder(tab_type),
        })
        .select()
        .single()

      if (error) {
        console.error("Error creating stick tab:", error)
        return NextResponse.json({ error: "Failed to create tab" }, { status: 500 })
      }

      return NextResponse.json({ tab: newTab })
    }
  } catch (err: any) {
    console.error("POST /api/sticks/[id]/tabs error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PUT /api/sticks/[id]/tabs
export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { user, error: authError } = await getCachedAuthUser()

    if (authError === "rate_limited") {
      return createRateLimitResponse()
    }

    if (!user) {
      return createUnauthorizedResponse()
    }

    const db = await createServiceDatabaseClient()

    const orgContext = await getOrgContext()
    if (!orgContext) {
      return NextResponse.json({ error: "Organization context required" }, { status: 403 })
    }

    const params = await context.params
    const stickId = params.id
    if (!validateUUID(stickId)) {
      return NextResponse.json({ error: "Invalid Stick ID" }, { status: 400 })
    }

    if (!(await safeRateLimit(request, user.id, "stick_tabs_write"))) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 })
    }

    const { hasPermission, error: permError, stick } = await checkStickPermissions(
      db,
      stickId,
      user.id,
      orgContext.orgId,
      "write",
    )
    if (!hasPermission) {
      return NextResponse.json({ error: permError || "Permission denied" }, { status: 403 })
    }

    // Use the stick's org_id for tab operations
    const stickOrgId = stick?.org_id || orgContext.orgId

    const body = await request.json()
    const { tab_type, tab_data } = body

    const { data: existingTab } = await db
      .from("paks_pad_stick_tabs")
      .select("id, tab_data")
      .eq("stick_id", stickId)
      .eq("tab_type", tab_type)
      .eq("org_id", stickOrgId)
      .maybeSingle()

    if (existingTab) {
      const { data: updatedTab, error } = await db
        .from("paks_pad_stick_tabs")
        .update({
          tab_data: normalizeTabData(tab_data),
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingTab.id)
        .eq("org_id", stickOrgId)
        .select(TAB_SELECT_COLUMNS)
        .single()

      if (error) {
        console.error("Error updating stick tab:", error)
        return NextResponse.json({ error: "Failed to update tab" }, { status: 500 })
      }

      return NextResponse.json({ tab: { ...updatedTab, tab_data: normalizeTabData(updatedTab.tab_data) } })
    } else {
      const { data: newTab, error } = await db
        .from("paks_pad_stick_tabs")
        .insert({
          stick_id: stickId,
          user_id: user.id,
          org_id: stickOrgId,
          tab_name: getTabName(tab_type),
          tab_type,
          tab_content: "",
          tab_data: normalizeTabData(tab_data),
          tab_order: getTabOrder(tab_type),
        })
        .select(TAB_SELECT_COLUMNS)
        .single()

      if (error) {
        console.error("Error creating stick tab:", error)
        return NextResponse.json({ error: "Failed to create tab" }, { status: 500 })
      }

      return NextResponse.json({ tab: { ...newTab, tab_data: normalizeTabData(newTab.tab_data) } })
    }
  } catch (err: any) {
    console.error("PUT /api/sticks/[id]/tabs error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

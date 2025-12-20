import { type NextRequest, NextResponse } from "next/server"
import { createServiceDatabaseClient } from "@/lib/database/database-adapter"
import type { DatabaseClient } from "@/lib/database/database-adapter"
import { validateUUID } from "@/lib/input-validation-enhanced"
import { applyRateLimit } from "@/lib/rate-limiter-enhanced"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from "@/lib/auth/cached-auth"

export const dynamic = "force-dynamic"

// Types
type DbTabType = "main" | "details" | "images" | "videos" | "tags" | "links"

interface VideoInfo {
  id: string
  url: string
  title?: string
  thumbnail?: string
  duration?: string | number
  platform?: "youtube" | "vimeo" | "rumble"
  embed_id?: string
  embed_url?: string
  added_at?: string
}

interface ImageInfo {
  id: string
  url: string
  title?: string
  alt?: string
  caption?: string
  size?: number
  type?: string
  width?: number
  height?: number
}

interface StickTabRow {
  id: string
  stick_id: string
  tab_name: string
  tab_type: DbTabType
  tab_content: string
  tab_data: {
    videos?: VideoInfo[]
    images?: ImageInfo[]
    content?: string
    metadata?: Record<string, string | number | boolean>
    tags?: string[]
    links?: string[]
  } | null
  tab_order: number
  created_at: string
  updated_at: string
  org_id: string
}

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

// Helper: Get tab name based on tab_type
function getTabName(tabType: string): string {
  const tabNames: Record<string, string> = {
    videos: "Videos",
    images: "Images",
    tags: "Tags",
    links: "Links",
  }
  return tabNames[tabType] || "Details"
}

// Helper: Get tab order based on tab_type
function getTabOrder(tabType: string): number {
  const tabOrders: Record<string, number> = {
    videos: 1,
    images: 2,
    tags: 3,
    links: 4,
  }
  return tabOrders[tabType] ?? 5
}

function normalizeTabData(input: any): {
  videos?: VideoInfo[]
  images?: ImageInfo[]
  content?: string
  metadata?: Record<string, string | number | boolean>
  tags?: string[]
  links?: string[]
  [k: string]: any
} {
  let obj: any = input
  try {
    if (obj && typeof obj === "string") {
      obj = JSON.parse(obj)
    }
  } catch {
    obj = {}
  }
  if (!obj || typeof obj !== "object") obj = {}
  if (obj.videos && !Array.isArray(obj.videos)) obj.videos = []
  if (obj.images && !Array.isArray(obj.images)) obj.images = []
  if (obj.tags && !Array.isArray(obj.tags)) obj.tags = []
  if (obj.links && !Array.isArray(obj.links)) obj.links = []
  return obj
}

async function checkStickPermissions(
  db: DatabaseClient,
  stickId: string,
  userId: string,
  orgId: string,
  action: "read" | "write",
) {
  // Get stick and pad info with org_id filter
  const { data: stick, error: stickError } = await db
    .from("paks_pad_sticks")
    .select("id, user_id, pad_id, org_id")
    .eq("id", stickId)
    .eq("org_id", orgId)
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

    const orgContext = await getOrgContext(user.id)
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

    const { hasPermission, error: permError } = await checkStickPermissions(
      db,
      stickId,
      user.id,
      orgContext.orgId,
      "read",
    )
    if (!hasPermission) {
      return NextResponse.json({ error: permError || "Permission denied" }, { status: 403 })
    }

    const { data, error } = await db
      .from("paks_pad_stick_tabs")
      .select("id, stick_id, tab_name, tab_type, tab_content, tab_data, tab_order, created_at, updated_at, org_id")
      .eq("stick_id", stickId)
      .eq("org_id", orgContext.orgId)
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
      const defaultTabs = [
        {
          stick_id: stickId,
          user_id: user.id,
          org_id: orgContext.orgId,
          tab_name: "Main",
          tab_type: "main" as DbTabType,
          tab_content: "",
          tab_data: {},
          tab_order: 0,
        },
        {
          stick_id: stickId,
          user_id: user.id,
          org_id: orgContext.orgId,
          tab_name: "Details",
          tab_type: "details" as DbTabType,
          tab_content: "",
          tab_data: {},
          tab_order: 1,
        },
      ]

      const { data: createdTabs, error: createError } = await db
        .from("paks_pad_stick_tabs")
        .insert(defaultTabs)
        .select("id, stick_id, tab_name, tab_type, tab_content, tab_data, tab_order, created_at, updated_at, org_id")

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

// Helper: Create tab item based on type
function createTabItem(
  tabType: string,
  url: string | undefined,
  title: string | undefined,
  type: string | undefined,
  thumbnail: string | undefined,
  metadata: Record<string, any> | undefined,
): { key: string; item: any } | null {
  const now = Date.now()
  const isoNow = new Date().toISOString()

  if (tabType === "videos" && url) {
    return {
      key: "videos",
      item: {
        id: `video_${now}`,
        url,
        title: title || `Video ${now}`,
        thumbnail,
        added_at: isoNow,
        ...metadata,
      } as VideoInfo,
    }
  }

  if (tabType === "images" && url) {
    return {
      key: "images",
      item: {
        id: `image_${now}`,
        url,
        title: title || `Image ${now}`,
        ...metadata,
      } as ImageInfo,
    }
  }

  if (tabType === "tags" && type) {
    return { key: "tags", item: type }
  }

  if (tabType === "links" && url) {
    return { key: "links", item: url }
  }

  return null
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

    const orgContext = await getOrgContext(user.id)
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

    const { hasPermission, error: permError } = await checkStickPermissions(
      db,
      stickId,
      user.id,
      orgContext.orgId,
      "write",
    )
    if (!hasPermission) {
      return NextResponse.json({ error: permError || "Permission denied" }, { status: 403 })
    }

    const body = await request.json()
    const { tab_type, type, url, title, thumbnail, metadata } = body

    const { data: existingTab } = await db
      .from("paks_pad_stick_tabs")
      .select("id, tab_data")
      .eq("stick_id", stickId)
      .eq("tab_type", tab_type)
      .eq("org_id", orgContext.orgId)
      .maybeSingle()

    const tabData = normalizeTabData(existingTab?.tab_data || {})

    // Add new item based on type using helper
    const newItem = createTabItem(tab_type, url, title, type, thumbnail, metadata)
    if (newItem) {
      const key = newItem.key as keyof typeof tabData
      const currentItems = (tabData[key] as any[]) || []
      ;(tabData as any)[key] = [...currentItems, newItem.item]
    }

    if (existingTab) {
      const { data: updatedTab, error } = await db
        .from("paks_pad_stick_tabs")
        .update({
          tab_data: tabData,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingTab.id)
        .eq("org_id", orgContext.orgId)
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

    const orgContext = await getOrgContext(user.id)
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

    const { hasPermission, error: permError } = await checkStickPermissions(
      db,
      stickId,
      user.id,
      orgContext.orgId,
      "write",
    )
    if (!hasPermission) {
      return NextResponse.json({ error: permError || "Permission denied" }, { status: 403 })
    }

    const body = await request.json()
    const { tab_type, tab_data } = body

    const { data: existingTab } = await db
      .from("paks_pad_stick_tabs")
      .select("id, tab_data")
      .eq("stick_id", stickId)
      .eq("tab_type", tab_type)
      .eq("org_id", orgContext.orgId)
      .maybeSingle()

    if (existingTab) {
      const { data: updatedTab, error } = await db
        .from("paks_pad_stick_tabs")
        .update({
          tab_data: normalizeTabData(tab_data),
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingTab.id)
        .eq("org_id", orgContext.orgId)
        .select("id, stick_id, tab_name, tab_type, tab_content, tab_data, tab_order, created_at, updated_at, org_id")
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

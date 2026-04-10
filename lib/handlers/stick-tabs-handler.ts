// Shared handler logic for stick tabs (v1 + v2 deduplication)
import { NextResponse } from "next/server"
import { query, querySingle } from "@/lib/database/pg-helpers"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { validateUUID } from "@/lib/input-validation-enhanced"

// Types
export type DbTabType = "main" | "details" | "images" | "videos" | "tags" | "links"

export interface VideoInfo {
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

export interface ImageInfo {
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

export interface ExportLink {
  url: string
  filename: string
  created_at: string
  type: string
}

export interface StickTabRow {
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
    exports?: ExportLink[]
  } | null
  tab_order: number
  created_at: string
  updated_at: string
  org_id: string
}

// Helper: Get tab name based on tab_type
export function getTabName(tabType: string): string {
  const tabNames: Record<string, string> = {
    videos: "Videos",
    images: "Images",
    tags: "Tags",
    links: "Links",
  }
  return tabNames[tabType] || "Details"
}

// Helper: Get tab order based on tab_type
export function getTabOrder(tabType: string): number {
  const tabOrders: Record<string, number> = {
    videos: 1,
    images: 2,
    tags: 3,
    links: 4,
  }
  return tabOrders[tabType] ?? 5
}

export function normalizeTabData(input: any): {
  videos?: VideoInfo[]
  images?: ImageInfo[]
  content?: string
  metadata?: Record<string, string | number | boolean>
  tags?: string[]
  links?: string[]
  exports?: ExportLink[]
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
  if (obj.exports && !Array.isArray(obj.exports)) obj.exports = []
  return obj
}

// Helper: Create tab item based on type
export function createTabItem(
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

// Applies a new item to tab_data based on tab_type and body fields.
export function applyNewItemToTabData(
  tabData: Record<string, any>,
  body: { tab_type: string; type?: string; url?: string; title?: string; thumbnail?: string; metadata?: Record<string, any> },
): Record<string, any> {
  const newItem = createTabItem(body.tab_type, body.url, body.title, body.type, body.thumbnail, body.metadata)
  if (newItem) {
    const key = newItem.key
    const currentItems = (tabData[key] as any[]) || []
    tabData[key] = [...currentItems, newItem.item]
  }
  return tabData
}

// Default tabs to create when no tabs exist for a stick
export function getDefaultTabInserts(stickId: string, userId: string, orgId: string) {
  return [
    {
      stick_id: stickId,
      user_id: userId,
      org_id: orgId,
      tab_name: "Main",
      tab_type: "main" as DbTabType,
      tab_content: "",
      tab_data: {},
      tab_order: 0,
    },
    {
      stick_id: stickId,
      user_id: userId,
      org_id: orgId,
      tab_name: "Details",
      tab_type: "details" as DbTabType,
      tab_content: "",
      tab_data: {},
      tab_order: 1,
    },
  ]
}

// Standard tab select columns
export const TAB_SELECT_COLUMNS = "id, stick_id, tab_name, tab_type, tab_content, tab_data, tab_order, created_at, updated_at, org_id"

// ── Shared auth + org guard ──────────────────────────────────────────
async function getAuthAndOrg(): Promise<
  { error: NextResponse } | { user: { id: string; email?: string }; orgId: string }
> {
  const authResult = await getCachedAuthUser()
  if (authResult.rateLimited) {
    return {
      error: NextResponse.json(
        { error: "Rate limit exceeded. Please try again in a moment." },
        { status: 429, headers: { "Retry-After": "30" } },
      ),
    }
  }
  if (!authResult.user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }

  const orgContext = await getOrgContext()
  if (!orgContext) {
    return { error: NextResponse.json({ error: "Organization context required" }, { status: 403 }) }
  }

  return { user: authResult.user, orgId: orgContext.orgId }
}

// Check stick permissions (read/write) via ownership + pad membership
async function checkStickPermissions(stickId: string, userId: string, orgId: string, action: "read" | "write") {
  const stick = await querySingle(
    `SELECT s.id, s.user_id, s.pad_id, s.org_id, p.owner_id as pad_owner_id
     FROM paks_pad_sticks s
     LEFT JOIN paks_pads p ON s.pad_id = p.id
     WHERE s.id = $1 AND s.org_id = $2`,
    [stickId, orgId],
  )

  if (!stick) {
    return { hasPermission: false as const, error: "Stick not found" }
  }

  // Check ownership
  if (stick.user_id === userId || stick.pad_owner_id === userId) {
    return { hasPermission: true as const, stick }
  }

  // Check membership
  const member = await querySingle(
    `SELECT role FROM paks_pad_members
     WHERE pad_id = $1 AND user_id = $2 AND accepted = true`,
    [stick.pad_id, userId],
  )

  if (member) {
    if (action === "read") {
      return { hasPermission: true as const, stick }
    }
    const canWrite = member.role === "admin" || member.role === "edit"
    return { hasPermission: canWrite, stick }
  }

  return { hasPermission: false as const, error: "Permission denied" }
}

// GET - Fetch tabs for a stick
export async function handleGetStickTabs(stickId: string): Promise<NextResponse> {
  try {
    const auth = await getAuthAndOrg()
    if ("error" in auth) return auth.error

    if (!validateUUID(stickId)) {
      return NextResponse.json({ error: "Invalid Stick ID" }, { status: 400 })
    }

    const { hasPermission, error: permError } = await checkStickPermissions(
      stickId, auth.user.id, auth.orgId, "read",
    )
    if (!hasPermission) {
      return NextResponse.json({ error: permError || "Permission denied" }, { status: 403 })
    }

    let tabs = await query(
      `SELECT ${TAB_SELECT_COLUMNS}
       FROM paks_pad_stick_tabs
       WHERE stick_id = $1 AND org_id = $2
       ORDER BY tab_order ASC`,
      [stickId, auth.orgId],
    )

    tabs = tabs.map((row: any) => ({
      ...row,
      tab_data: normalizeTabData(row.tab_data),
    }))

    // Create default tabs if none exist
    if (tabs.length === 0) {
      const defaultTabs = getDefaultTabInserts(stickId, auth.user.id, auth.orgId)

      for (const tab of defaultTabs) {
        await querySingle(
          `INSERT INTO paks_pad_stick_tabs
           (stick_id, user_id, org_id, tab_name, tab_type, tab_content, tab_data, tab_order)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [tab.stick_id, tab.user_id, tab.org_id, tab.tab_name, tab.tab_type, tab.tab_content, "{}", tab.tab_order],
        )
      }

      tabs = await query(
        `SELECT ${TAB_SELECT_COLUMNS}
         FROM paks_pad_stick_tabs
         WHERE stick_id = $1 AND org_id = $2
         ORDER BY tab_order ASC`,
        [stickId, auth.orgId],
      )

      tabs = tabs.map((row: any) => ({
        ...row,
        tab_data: normalizeTabData(row.tab_data),
      }))
    }

    return NextResponse.json({ tabs })
  } catch (err: any) {
    console.error("GET stick tabs error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST - Add item to a stick tab
export async function handlePostStickTab(request: Request, stickId: string): Promise<NextResponse> {
  try {
    const auth = await getAuthAndOrg()
    if ("error" in auth) return auth.error

    if (!validateUUID(stickId)) {
      return NextResponse.json({ error: "Invalid Stick ID" }, { status: 400 })
    }

    const { hasPermission, error: permError } = await checkStickPermissions(
      stickId, auth.user.id, auth.orgId, "write",
    )
    if (!hasPermission) {
      return NextResponse.json({ error: permError || "Permission denied" }, { status: 403 })
    }

    const body = await request.json()
    const { tab_type, type, url, title, thumbnail, metadata } = body

    // Get existing tab
    const existingTab = await querySingle(
      `SELECT id, tab_data FROM paks_pad_stick_tabs
       WHERE stick_id = $1 AND tab_type = $2 AND org_id = $3`,
      [stickId, tab_type, auth.orgId],
    )

    const tabData = normalizeTabData(existingTab?.tab_data || {})

    // Add new item based on type using shared helper
    applyNewItemToTabData(tabData, { tab_type, type, url, title, thumbnail, metadata })

    if (existingTab) {
      const tab = await querySingle(
        `UPDATE paks_pad_stick_tabs
         SET tab_data = $1, updated_at = NOW()
         WHERE id = $2
         RETURNING *`,
        [JSON.stringify(tabData), existingTab.id],
      )
      return NextResponse.json({ tab })
    } else {
      const tab = await querySingle(
        `INSERT INTO paks_pad_stick_tabs
         (stick_id, user_id, org_id, tab_name, tab_type, tab_content, tab_data, tab_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [stickId, auth.user.id, auth.orgId, getTabName(tab_type), tab_type, "", JSON.stringify(tabData), getTabOrder(tab_type)],
      )
      return NextResponse.json({ tab })
    }
  } catch (err: any) {
    console.error("POST stick tabs error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PUT - Update tab data
export async function handlePutStickTab(request: Request, stickId: string): Promise<NextResponse> {
  try {
    const auth = await getAuthAndOrg()
    if ("error" in auth) return auth.error

    if (!validateUUID(stickId)) {
      return NextResponse.json({ error: "Invalid Stick ID" }, { status: 400 })
    }

    const { hasPermission, error: permError } = await checkStickPermissions(
      stickId, auth.user.id, auth.orgId, "write",
    )
    if (!hasPermission) {
      return NextResponse.json({ error: permError || "Permission denied" }, { status: 403 })
    }

    const body = await request.json()
    const { tab_type, tab_data } = body

    const existingTab = await querySingle(
      `SELECT id FROM paks_pad_stick_tabs
       WHERE stick_id = $1 AND tab_type = $2 AND org_id = $3`,
      [stickId, tab_type, auth.orgId],
    )

    const normalizedData = normalizeTabData(tab_data)

    if (existingTab) {
      const tab = await querySingle(
        `UPDATE paks_pad_stick_tabs
         SET tab_data = $1, updated_at = NOW()
         WHERE id = $2
         RETURNING ${TAB_SELECT_COLUMNS}`,
        [JSON.stringify(normalizedData), existingTab.id],
      )
      return NextResponse.json({ tab: { ...tab, tab_data: normalizeTabData(tab?.tab_data) } })
    } else {
      const tab = await querySingle(
        `INSERT INTO paks_pad_stick_tabs
         (stick_id, user_id, org_id, tab_name, tab_type, tab_content, tab_data, tab_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING ${TAB_SELECT_COLUMNS}`,
        [stickId, auth.user.id, auth.orgId, getTabName(tab_type), tab_type, "", JSON.stringify(normalizedData), getTabOrder(tab_type)],
      )
      return NextResponse.json({ tab: { ...tab, tab_data: normalizeTabData(tab?.tab_data) } })
    }
  } catch (err: any) {
    console.error("PUT stick tabs error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

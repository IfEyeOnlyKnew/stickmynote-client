// v2 Sticks Tabs API: production-quality, manage stick tabs
import { type NextRequest } from 'next/server'
import { db } from '@/lib/database/pg-client'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { getOrgContext } from '@/lib/auth/get-org-context'
import { handleApiError } from '@/lib/api/handle-api-error'

export const dynamic = 'force-dynamic'

function getTabName(tabType: string): string {
  const tabNames: Record<string, string> = {
    videos: 'Videos',
    images: 'Images',
    tags: 'Tags',
    links: 'Links',
  }
  return tabNames[tabType] || 'Details'
}

function getTabOrder(tabType: string): number {
  const tabOrders: Record<string, number> = {
    videos: 1,
    images: 2,
    tags: 3,
    links: 4,
  }
  return tabOrders[tabType] ?? 5
}

function normalizeTabData(input: any): Record<string, any> {
  let obj = input
  try {
    if (obj && typeof obj === 'string') {
      obj = JSON.parse(obj)
    }
  } catch {
    obj = {}
  }
  if (!obj || typeof obj !== 'object') obj = {}
  return obj
}

async function checkStickPermissions(stickId: string, userId: string, orgId: string, action: 'read' | 'write') {
  const stickResult = await db.query(
    `SELECT s.id, s.user_id, s.pad_id, p.owner_id as pad_owner_id
     FROM paks_pad_sticks s
     LEFT JOIN paks_pads p ON s.pad_id = p.id
     WHERE s.id = $1 AND s.org_id = $2`,
    [stickId, orgId]
  )

  if (stickResult.rows.length === 0) {
    return { hasPermission: false, error: 'Stick not found' }
  }

  const stick = stickResult.rows[0]

  // Check ownership
  if (stick.user_id === userId || stick.pad_owner_id === userId) {
    return { hasPermission: true, stick }
  }

  // Check membership
  const memberResult = await db.query(
    `SELECT role FROM paks_pad_members
     WHERE pad_id = $1 AND user_id = $2 AND accepted = true`,
    [stick.pad_id, userId]
  )

  if (memberResult.rows.length > 0) {
    if (action === 'read') {
      return { hasPermission: true, stick }
    }
    const canWrite = memberResult.rows[0].role === 'admin' || memberResult.rows[0].role === 'edit'
    return { hasPermission: canWrite, stick }
  }

  return { hasPermission: false, error: 'Permission denied' }
}

// GET /api/v2/sticks/[id]/tabs - Get tabs
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: stickId } = await params

    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }),
        { status: 429, headers: { 'Retry-After': '30' } }
      )
    }
    if (!authResult.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }
    const user = authResult.user

    const orgContext = await getOrgContext()
    if (!orgContext) {
      return new Response(JSON.stringify({ error: 'Organization context required' }), { status: 403 })
    }

    const { hasPermission, error: permError } = await checkStickPermissions(
      stickId, user.id, orgContext.orgId, 'read'
    )

    if (!hasPermission) {
      return new Response(JSON.stringify({ error: permError || 'Permission denied' }), { status: 403 })
    }

    const tabsResult = await db.query(
      `SELECT id, stick_id, tab_name, tab_type, tab_content, tab_data, tab_order, created_at, updated_at, org_id
       FROM paks_pad_stick_tabs
       WHERE stick_id = $1 AND org_id = $2
       ORDER BY tab_order ASC`,
      [stickId, orgContext.orgId]
    )

    let tabs = tabsResult.rows.map((row: any) => ({
      ...row,
      tab_data: normalizeTabData(row.tab_data),
    }))

    // Create default tabs if none exist
    if (tabs.length === 0) {
      const defaultTabs = [
        { tab_name: 'Main', tab_type: 'main', tab_order: 0 },
        { tab_name: 'Details', tab_type: 'details', tab_order: 1 },
      ]

      for (const tab of defaultTabs) {
        await db.query(
          `INSERT INTO paks_pad_stick_tabs
           (stick_id, user_id, org_id, tab_name, tab_type, tab_content, tab_data, tab_order)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [stickId, user.id, orgContext.orgId, tab.tab_name, tab.tab_type, '', '{}', tab.tab_order]
        )
      }

      const newTabsResult = await db.query(
        `SELECT id, stick_id, tab_name, tab_type, tab_content, tab_data, tab_order, created_at, updated_at, org_id
         FROM paks_pad_stick_tabs
         WHERE stick_id = $1 AND org_id = $2
         ORDER BY tab_order ASC`,
        [stickId, orgContext.orgId]
      )

      tabs = newTabsResult.rows.map((row: any) => ({
        ...row,
        tab_data: normalizeTabData(row.tab_data),
      }))
    }

    return new Response(JSON.stringify({ tabs }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

// POST /api/v2/sticks/[id]/tabs - Add item to tab
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: stickId } = await params

    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }),
        { status: 429, headers: { 'Retry-After': '30' } }
      )
    }
    if (!authResult.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }
    const user = authResult.user

    const orgContext = await getOrgContext()
    if (!orgContext) {
      return new Response(JSON.stringify({ error: 'Organization context required' }), { status: 403 })
    }

    const { hasPermission, error: permError } = await checkStickPermissions(
      stickId, user.id, orgContext.orgId, 'write'
    )

    if (!hasPermission) {
      return new Response(JSON.stringify({ error: permError || 'Permission denied' }), { status: 403 })
    }

    const body = await request.json()
    const { tab_type, type, url, title, thumbnail, metadata } = body

    // Get existing tab
    const existingResult = await db.query(
      `SELECT id, tab_data FROM paks_pad_stick_tabs
       WHERE stick_id = $1 AND tab_type = $2 AND org_id = $3`,
      [stickId, tab_type, orgContext.orgId]
    )

    const tabData = normalizeTabData(existingResult.rows[0]?.tab_data || {})
    const now = Date.now()
    const isoNow = new Date().toISOString()

    // Add new item based on type
    if (tab_type === 'videos' && url) {
      const videos = tabData.videos || []
      videos.push({
        id: `video_${now}`,
        url,
        title: title || `Video ${now}`,
        thumbnail,
        added_at: isoNow,
        ...metadata,
      })
      tabData.videos = videos
    } else if (tab_type === 'images' && url) {
      const images = tabData.images || []
      images.push({
        id: `image_${now}`,
        url,
        title: title || `Image ${now}`,
        ...metadata,
      })
      tabData.images = images
    } else if (tab_type === 'tags' && type) {
      const tags = tabData.tags || []
      tags.push(type)
      tabData.tags = tags
    } else if (tab_type === 'links' && url) {
      const links = tabData.links || []
      links.push(url)
      tabData.links = links
    }

    if (existingResult.rows.length > 0) {
      const updateResult = await db.query(
        `UPDATE paks_pad_stick_tabs
         SET tab_data = $1, updated_at = NOW()
         WHERE id = $2
         RETURNING *`,
        [JSON.stringify(tabData), existingResult.rows[0].id]
      )
      return new Response(JSON.stringify({ tab: updateResult.rows[0] }), { status: 200 })
    } else {
      const insertResult = await db.query(
        `INSERT INTO paks_pad_stick_tabs
         (stick_id, user_id, org_id, tab_name, tab_type, tab_content, tab_data, tab_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [stickId, user.id, orgContext.orgId, getTabName(tab_type), tab_type, '', JSON.stringify(tabData), getTabOrder(tab_type)]
      )
      return new Response(JSON.stringify({ tab: insertResult.rows[0] }), { status: 200 })
    }
  } catch (error) {
    return handleApiError(error)
  }
}

// PUT /api/v2/sticks/[id]/tabs - Update tab data
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: stickId } = await params

    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }),
        { status: 429, headers: { 'Retry-After': '30' } }
      )
    }
    if (!authResult.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }
    const user = authResult.user

    const orgContext = await getOrgContext()
    if (!orgContext) {
      return new Response(JSON.stringify({ error: 'Organization context required' }), { status: 403 })
    }

    const { hasPermission, error: permError } = await checkStickPermissions(
      stickId, user.id, orgContext.orgId, 'write'
    )

    if (!hasPermission) {
      return new Response(JSON.stringify({ error: permError || 'Permission denied' }), { status: 403 })
    }

    const body = await request.json()
    const { tab_type, tab_data } = body

    const existingResult = await db.query(
      `SELECT id FROM paks_pad_stick_tabs
       WHERE stick_id = $1 AND tab_type = $2 AND org_id = $3`,
      [stickId, tab_type, orgContext.orgId]
    )

    if (existingResult.rows.length > 0) {
      const updateResult = await db.query(
        `UPDATE paks_pad_stick_tabs
         SET tab_data = $1, updated_at = NOW()
         WHERE id = $2
         RETURNING *`,
        [JSON.stringify(normalizeTabData(tab_data)), existingResult.rows[0].id]
      )
      return new Response(JSON.stringify({ tab: { ...updateResult.rows[0], tab_data: normalizeTabData(updateResult.rows[0].tab_data) } }), { status: 200 })
    } else {
      const insertResult = await db.query(
        `INSERT INTO paks_pad_stick_tabs
         (stick_id, user_id, org_id, tab_name, tab_type, tab_content, tab_data, tab_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [stickId, user.id, orgContext.orgId, getTabName(tab_type), tab_type, '', JSON.stringify(normalizeTabData(tab_data)), getTabOrder(tab_type)]
      )
      return new Response(JSON.stringify({ tab: { ...insertResult.rows[0], tab_data: normalizeTabData(insertResult.rows[0].tab_data) } }), { status: 200 })
    }
  } catch (error) {
    return handleApiError(error)
  }
}

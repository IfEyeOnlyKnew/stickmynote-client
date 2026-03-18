// v2 Social Sticks Tabs API: production-quality, manage stick tabs
import { type NextRequest } from 'next/server'
import { db } from '@/lib/database/pg-client'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { getOrgContext } from '@/lib/auth/get-org-context'
import { handleApiError } from '@/lib/api/handle-api-error'

export const dynamic = 'force-dynamic'

// GET /api/v2/inference-sticks/[stickId]/tabs - Get tabs
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ stickId: string }> }
) {
  try {
    const { stickId } = await params

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

    const result = await db.query(
      `SELECT * FROM social_stick_tabs WHERE social_stick_id = $1`,
      [stickId]
    )

    // Sort by tab_order or created_at
    const sortedTabs = result.rows.sort((a: any, b: any) => {
      if (a.tab_order !== undefined && b.tab_order !== undefined) {
        return a.tab_order - b.tab_order
      }
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    })

    return new Response(JSON.stringify({ tabs: sortedTabs }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

// POST /api/v2/inference-sticks/[stickId]/tabs - Create or update tab
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ stickId: string }> }
) {
  try {
    const { stickId } = await params

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

    const orgContext = await getOrgContext()

    const body = await request.json()
    const { tabType, tabName, title, tabData, items, tabOrder = 0 } = body

    // Determine final tab data
    let finalTabData = tabData
    if (items) {
      finalTabData = { [tabType]: items }
    }

    const tabTitle = title || tabName || tabType

    // Check if tab exists
    const existingResult = await db.query(
      `SELECT * FROM social_stick_tabs
       WHERE social_stick_id = $1 AND tab_type = $2`,
      [stickId, tabType]
    )

    if (existingResult.rows.length > 0) {
      // Update existing tab
      const updateResult = await db.query(
        `UPDATE social_stick_tabs
         SET tab_data = $1, updated_at = NOW()
         WHERE id = $2
         RETURNING *`,
        [JSON.stringify(finalTabData), existingResult.rows[0].id]
      )
      return new Response(JSON.stringify({ tab: updateResult.rows[0] }), { status: 200 })
    }

    // Create new tab
    const insertResult = await db.query(
      `INSERT INTO social_stick_tabs (social_stick_id, tab_type, title, tab_data, tab_order, org_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [stickId, tabType, tabTitle, JSON.stringify(finalTabData), tabOrder, orgContext?.orgId || null]
    )

    return new Response(JSON.stringify({ tab: insertResult.rows[0] }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

// DELETE /api/v2/inference-sticks/[stickId]/tabs - Delete tab or item
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ stickId: string }> }
) {
  try {
    const { stickId } = await params

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

    const body = await request.json()
    const { tabId, tabType, itemId } = body

    if (tabId) {
      // Delete entire tab
      await db.query(`DELETE FROM social_stick_tabs WHERE id = $1`, [tabId])
      return new Response(JSON.stringify({ success: true }), { status: 200 })
    }

    if (tabType && itemId) {
      // Delete specific item from tab
      const existingResult = await db.query(
        `SELECT * FROM social_stick_tabs
         WHERE social_stick_id = $1 AND tab_type = $2`,
        [stickId, tabType]
      )

      if (existingResult.rows.length === 0) {
        return new Response(JSON.stringify({ error: 'Tab not found' }), { status: 404 })
      }

      const existingTab = existingResult.rows[0]
      const tabData = existingTab.tab_data || {}
      const items = tabData[tabType] || []
      const updatedItems = items.filter((item: any) => item.id !== itemId)

      await db.query(
        `UPDATE social_stick_tabs
         SET tab_data = $1, updated_at = NOW()
         WHERE id = $2`,
        [JSON.stringify({ [tabType]: updatedItems }), existingTab.id]
      )

      return new Response(JSON.stringify({ success: true }), { status: 200 })
    }

    return new Response(
      JSON.stringify({ error: 'Either tabId or both tabType and itemId are required' }),
      { status: 400 }
    )
  } catch (error) {
    return handleApiError(error)
  }
}

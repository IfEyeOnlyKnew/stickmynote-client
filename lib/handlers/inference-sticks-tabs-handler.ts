// Inference Sticks Tabs handler - shared logic between v1 and v2 API routes
import { db } from '@/lib/database/pg-client'

// ============================================================================
// Core Logic
// ============================================================================

/**
 * Get all tabs for a stick, sorted by tab_order or created_at.
 */
export async function getStickTabs(stickId: string): Promise<any[]> {
  const result = await db.query(
    `SELECT * FROM social_stick_tabs WHERE social_stick_id = $1`,
    [stickId]
  )

  return result.rows.toSorted((a: any, b: any) => {
    if (a.tab_order !== undefined && b.tab_order !== undefined) {
      return a.tab_order - b.tab_order
    }
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  })
}

/**
 * Create or update a tab for a stick.
 */
export async function upsertStickTab(
  stickId: string,
  input: {
    tabType: string
    tabName?: string
    title?: string
    tabData?: any
    items?: any
    tabOrder?: number
  },
  orgId?: string | null
): Promise<any> {
  // Determine final tab data
  let finalTabData = input.tabData
  if (input.items) {
    finalTabData = { [input.tabType]: input.items }
  }

  const tabTitle = input.title || input.tabName || input.tabType
  const tabOrder = input.tabOrder ?? 0

  // Check if tab exists
  const existingResult = await db.query(
    `SELECT * FROM social_stick_tabs
     WHERE social_stick_id = $1 AND tab_type = $2`,
    [stickId, input.tabType]
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
    return updateResult.rows[0]
  }

  // Create new tab
  const insertResult = await db.query(
    `INSERT INTO social_stick_tabs (social_stick_id, tab_type, title, tab_data, tab_order, org_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [stickId, input.tabType, tabTitle, JSON.stringify(finalTabData), tabOrder, orgId || null]
  )

  return insertResult.rows[0]
}

/**
 * Delete a tab entirely.
 */
export async function deleteStickTab(tabId: string): Promise<void> {
  await db.query(`DELETE FROM social_stick_tabs WHERE id = $1`, [tabId])
}

/**
 * Delete a specific item from a tab's data. Returns false if tab not found.
 */
export async function deleteStickTabItem(
  stickId: string,
  tabType: string,
  itemId: string
): Promise<boolean> {
  const existingResult = await db.query(
    `SELECT * FROM social_stick_tabs
     WHERE social_stick_id = $1 AND tab_type = $2`,
    [stickId, tabType]
  )

  if (existingResult.rows.length === 0) {
    return false
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

  return true
}

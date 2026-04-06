// Discussion Templates [templateId] handler - shared logic for v2 route
// (No v1 [templateId] route exists, but extracting reusable helpers.)
import { db } from '@/lib/database/pg-client'
import type { OrgContext } from '@/lib/auth/get-org-context'
import type { UpdateTemplateRequest } from '@/types/discussion-templates'

// ============================================================================
// Helpers
// ============================================================================

/**
 * Build dynamic UPDATE query parts from a template update body.
 */
export function buildTemplateUpdates(body: UpdateTemplateRequest): {
  updates: string[]
  values: any[]
  paramCount: number
} {
  const stringFields = ['name', 'description', 'category', 'goal_text', 'expected_outcome']
  const jsonFields = ['required_categories', 'optional_categories', 'category_flow', 'scoring_rubric', 'milestones']
  const directFields = ['completion_mode', 'require_approval', 'min_approvers', 'icon_name', 'color_scheme', 'is_public']

  const updates: string[] = []
  const values: any[] = []
  let paramCount = 0

  for (const field of stringFields) {
    if ((body as any)[field] !== undefined) {
      paramCount++
      updates.push(`${field} = $${paramCount}`)
      values.push((body as any)[field]?.trim() || null)
    }
  }

  for (const field of jsonFields) {
    if ((body as any)[field] !== undefined) {
      paramCount++
      updates.push(`${field} = $${paramCount}`)
      values.push(JSON.stringify((body as any)[field]))
    }
  }

  for (const field of directFields) {
    if ((body as any)[field] !== undefined) {
      paramCount++
      updates.push(`${field} = $${paramCount}`)
      values.push((body as any)[field])
    }
  }

  return { updates, values, paramCount }
}

/**
 * Format a template row to a consistent response object.
 */
export function formatTemplate(row: any) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    category: row.category,
    is_system: row.is_system,
    is_public: row.is_public,
    goal_text: row.goal_text,
    expected_outcome: row.expected_outcome,
    required_categories: row.required_categories || [],
    optional_categories: row.optional_categories || [],
    category_flow: row.category_flow || [],
    milestones: row.milestones || [],
    completion_mode: row.completion_mode,
    auto_complete_threshold: row.auto_complete_threshold,
    require_approval: row.require_approval,
    min_approvers: row.min_approvers,
    approval_roles: row.approval_roles || [],
    icon_name: row.icon_name,
    color_scheme: row.color_scheme,
    use_count: row.use_count,
    created_by: row.created_by,
    org_id: row.org_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

// ============================================================================
// Core Logic
// ============================================================================

/**
 * Get a single discussion template by ID.
 */
export async function getTemplate(
  templateId: string,
  userId: string,
  orgContext: OrgContext | null
): Promise<{ status: number; body: any }> {
  const result = await db.query(
    `SELECT
      id, name, description, category,
      is_system, is_public,
      goal_text, expected_outcome,
      required_categories, optional_categories, category_flow, milestones,
      completion_mode, auto_complete_threshold,
      require_approval, min_approvers, approval_roles,
      icon_name, color_scheme,
      use_count, created_by, org_id,
      created_at, updated_at
    FROM discussion_templates
    WHERE id = $1
      AND (
        is_system = true
        OR is_public = true
        ${orgContext?.orgId ? 'OR org_id = $2' : ''}
        OR created_by = $${orgContext?.orgId ? '3' : '2'}
      )`,
    orgContext?.orgId
      ? [templateId, orgContext.orgId, userId]
      : [templateId, userId]
  )

  if (result.rows.length === 0) {
    return { status: 404, body: { error: 'Template not found' } }
  }

  return { status: 200, body: { template: formatTemplate(result.rows[0]) } }
}

/**
 * Update a discussion template.
 */
export async function updateTemplate(
  templateId: string,
  userId: string,
  orgContext: OrgContext | null,
  body: UpdateTemplateRequest
): Promise<{ status: number; body: any }> {
  // Check existence and ownership
  const existingResult = await db.query(
    `SELECT id, is_system, created_by, org_id
     FROM discussion_templates
     WHERE id = $1`,
    [templateId]
  )

  if (existingResult.rows.length === 0) {
    return { status: 404, body: { error: 'Template not found' } }
  }

  const existing = existingResult.rows[0]

  if (existing.is_system) {
    return { status: 403, body: { error: 'Cannot modify system templates' } }
  }

  const isOwner = existing.created_by === userId
  const isOrgAdmin = (orgContext?.role === 'admin' || orgContext?.role === 'owner') && existing.org_id === orgContext?.orgId

  if (!isOwner && !isOrgAdmin) {
    return { status: 403, body: { error: 'Not authorized to modify this template' } }
  }

  const { updates, values, paramCount } = buildTemplateUpdates(body)

  if (updates.length === 0) {
    return { status: 400, body: { error: 'No updates provided' } }
  }

  const idParam = paramCount + 1
  values.push(templateId)

  const result = await db.query(
    `UPDATE discussion_templates
     SET ${updates.join(', ')}, updated_at = NOW()
     WHERE id = $${idParam}
     RETURNING *`,
    values
  )

  return { status: 200, body: { template: formatTemplate(result.rows[0]) } }
}

/**
 * Delete a discussion template.
 */
export async function deleteTemplate(
  templateId: string,
  userId: string,
  orgContext: OrgContext | null
): Promise<{ status: number; body: any }> {
  const existingResult = await db.query(
    `SELECT id, is_system, created_by, org_id
     FROM discussion_templates
     WHERE id = $1`,
    [templateId]
  )

  if (existingResult.rows.length === 0) {
    return { status: 404, body: { error: 'Template not found' } }
  }

  const existing = existingResult.rows[0]

  if (existing.is_system) {
    return { status: 403, body: { error: 'Cannot delete system templates' } }
  }

  const isOwner = existing.created_by === userId
  const isOrgAdmin = (orgContext?.role === 'admin' || orgContext?.role === 'owner') && existing.org_id === orgContext?.orgId

  if (!isOwner && !isOrgAdmin) {
    return { status: 403, body: { error: 'Not authorized to delete this template' } }
  }

  await db.query(`DELETE FROM discussion_templates WHERE id = $1`, [templateId])

  return { status: 200, body: { success: true } }
}

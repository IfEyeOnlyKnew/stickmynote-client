// v2 Discussion Templates API: Get, update, delete single template
import { type NextRequest } from "next/server"
import { db } from "@/lib/database/pg-client"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { handleApiError } from "@/lib/api/handle-api-error"
import type { UpdateTemplateRequest } from "@/types/discussion-templates"

export const dynamic = "force-dynamic"

// GET /api/v2/discussion-templates/[templateId] - Get single template
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ templateId: string }> }
) {
  try {
    const { templateId } = await params

    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) {
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
        { status: 429, headers: { "Retry-After": "30" } }
      )
    }
    if (!authResult.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
    }

    const orgContext = await getOrgContext()

    // Get the template - must be system, public, owned by user, or in user's org
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
          ${orgContext?.orgId ? "OR org_id = $2" : ""}
          OR created_by = $${orgContext?.orgId ? "3" : "2"}
        )`,
      orgContext?.orgId
        ? [templateId, orgContext.orgId, authResult.user.id]
        : [templateId, authResult.user.id]
    )

    if (result.rows.length === 0) {
      return new Response(JSON.stringify({ error: "Template not found" }), { status: 404 })
    }

    const row = result.rows[0]

    return new Response(
      JSON.stringify({
        template: {
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
        },
      }),
      { status: 200 }
    )
  } catch (error) {
    return handleApiError(error)
  }
}

// PATCH /api/v2/discussion-templates/[templateId] - Update template
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ templateId: string }> }
) {
  try {
    const { templateId } = await params

    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) {
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
        { status: 429, headers: { "Retry-After": "30" } }
      )
    }
    if (!authResult.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
    }

    const orgContext = await getOrgContext()

    // Check if template exists and user can modify it (not system, owned by user or org admin)
    const existingResult = await db.query(
      `SELECT id, is_system, created_by, org_id
       FROM discussion_templates
       WHERE id = $1`,
      [templateId]
    )

    if (existingResult.rows.length === 0) {
      return new Response(JSON.stringify({ error: "Template not found" }), { status: 404 })
    }

    const existing = existingResult.rows[0]

    if (existing.is_system) {
      return new Response(
        JSON.stringify({ error: "Cannot modify system templates" }),
        { status: 403 }
      )
    }

    const isOwner = existing.created_by === authResult.user.id
    const isOrgAdmin = (orgContext?.role === "admin" || orgContext?.role === "owner") && existing.org_id === orgContext?.orgId

    if (!isOwner && !isOrgAdmin) {
      return new Response(
        JSON.stringify({ error: "Not authorized to modify this template" }),
        { status: 403 }
      )
    }

    const body: UpdateTemplateRequest = await request.json()

    // Build update query dynamically
    const updates: string[] = []
    const values: any[] = []
    let paramCount = 0

    if (body.name !== undefined) {
      paramCount++
      updates.push(`name = $${paramCount}`)
      values.push(body.name.trim())
    }
    if (body.description !== undefined) {
      paramCount++
      updates.push(`description = $${paramCount}`)
      values.push(body.description?.trim() || null)
    }
    if (body.category !== undefined) {
      paramCount++
      updates.push(`category = $${paramCount}`)
      values.push(body.category.trim())
    }
    if (body.goal_text !== undefined) {
      paramCount++
      updates.push(`goal_text = $${paramCount}`)
      values.push(body.goal_text?.trim() || null)
    }
    if (body.expected_outcome !== undefined) {
      paramCount++
      updates.push(`expected_outcome = $${paramCount}`)
      values.push(body.expected_outcome?.trim() || null)
    }
    if (body.required_categories !== undefined) {
      paramCount++
      updates.push(`required_categories = $${paramCount}`)
      values.push(JSON.stringify(body.required_categories))
    }
    if (body.optional_categories !== undefined) {
      paramCount++
      updates.push(`optional_categories = $${paramCount}`)
      values.push(JSON.stringify(body.optional_categories))
    }
    if (body.category_flow !== undefined) {
      paramCount++
      updates.push(`category_flow = $${paramCount}`)
      values.push(JSON.stringify(body.category_flow))
    }
    if (body.milestones !== undefined) {
      paramCount++
      updates.push(`milestones = $${paramCount}`)
      values.push(JSON.stringify(body.milestones))
    }
    if (body.completion_mode !== undefined) {
      paramCount++
      updates.push(`completion_mode = $${paramCount}`)
      values.push(body.completion_mode)
    }
    if (body.require_approval !== undefined) {
      paramCount++
      updates.push(`require_approval = $${paramCount}`)
      values.push(body.require_approval)
    }
    if (body.min_approvers !== undefined) {
      paramCount++
      updates.push(`min_approvers = $${paramCount}`)
      values.push(body.min_approvers)
    }
    if (body.icon_name !== undefined) {
      paramCount++
      updates.push(`icon_name = $${paramCount}`)
      values.push(body.icon_name)
    }
    if (body.color_scheme !== undefined) {
      paramCount++
      updates.push(`color_scheme = $${paramCount}`)
      values.push(body.color_scheme)
    }
    if (body.is_public !== undefined) {
      paramCount++
      updates.push(`is_public = $${paramCount}`)
      values.push(body.is_public)
    }

    if (updates.length === 0) {
      return new Response(JSON.stringify({ error: "No updates provided" }), { status: 400 })
    }

    paramCount++
    values.push(templateId)

    const result = await db.query(
      `UPDATE discussion_templates
       SET ${updates.join(", ")}, updated_at = NOW()
       WHERE id = $${paramCount}
       RETURNING *`,
      values
    )

    const row = result.rows[0]

    return new Response(
      JSON.stringify({
        template: {
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
        },
      }),
      { status: 200 }
    )
  } catch (error) {
    return handleApiError(error)
  }
}

// DELETE /api/v2/discussion-templates/[templateId] - Delete template
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ templateId: string }> }
) {
  try {
    const { templateId } = await params

    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) {
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
        { status: 429, headers: { "Retry-After": "30" } }
      )
    }
    if (!authResult.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
    }

    const orgContext = await getOrgContext()

    // Check if template exists and user can delete it
    const existingResult = await db.query(
      `SELECT id, is_system, created_by, org_id
       FROM discussion_templates
       WHERE id = $1`,
      [templateId]
    )

    if (existingResult.rows.length === 0) {
      return new Response(JSON.stringify({ error: "Template not found" }), { status: 404 })
    }

    const existing = existingResult.rows[0]

    if (existing.is_system) {
      return new Response(
        JSON.stringify({ error: "Cannot delete system templates" }),
        { status: 403 }
      )
    }

    const isOwner = existing.created_by === authResult.user.id
    const isOrgAdmin = (orgContext?.role === "admin" || orgContext?.role === "owner") && existing.org_id === orgContext?.orgId

    if (!isOwner && !isOrgAdmin) {
      return new Response(
        JSON.stringify({ error: "Not authorized to delete this template" }),
        { status: 403 }
      )
    }

    await db.query(`DELETE FROM discussion_templates WHERE id = $1`, [templateId])

    return new Response(JSON.stringify({ success: true }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

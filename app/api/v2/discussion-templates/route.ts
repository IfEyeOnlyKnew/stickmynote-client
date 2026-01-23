// v2 Discussion Templates API: List and create discussion templates
import { type NextRequest } from "next/server"
import { db } from "@/lib/database/pg-client"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { handleApiError } from "@/lib/api/handle-api-error"
import type { DiscussionTemplate, CreateTemplateRequest } from "@/types/discussion-templates"

export const dynamic = "force-dynamic"

// GET /api/v2/discussion-templates - List all available templates
export async function GET(request: NextRequest) {
  try {
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

    // Get category filter from query params
    const { searchParams } = new URL(request.url)
    const category = searchParams.get("category")

    // Build query - get system templates, org templates, and user's own templates
    let query = `
      SELECT
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
      WHERE (
        is_system = true
        OR is_public = true
        ${orgContext?.orgId ? "OR org_id = $1" : ""}
        OR created_by = $${orgContext?.orgId ? "2" : "1"}
      )
    `

    const values: any[] = []
    let paramCount = 0

    if (orgContext?.orgId) {
      paramCount++
      values.push(orgContext.orgId)
    }
    paramCount++
    values.push(authResult.user.id)

    if (category) {
      paramCount++
      query += ` AND category = $${paramCount}`
      values.push(category)
    }

    query += ` ORDER BY is_system DESC, use_count DESC, name ASC`

    const result = await db.query(query, values)

    const templates: DiscussionTemplate[] = result.rows.map((row) => ({
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
    }))

    return new Response(JSON.stringify({ templates }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

// POST /api/v2/discussion-templates - Create a new template
export async function POST(request: NextRequest) {
  try {
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

    const body: CreateTemplateRequest = await request.json()

    // Validate required fields
    if (!body.name?.trim()) {
      return new Response(JSON.stringify({ error: "Name is required" }), { status: 400 })
    }
    if (!body.category?.trim()) {
      return new Response(JSON.stringify({ error: "Category is required" }), { status: 400 })
    }
    if (!body.required_categories || body.required_categories.length === 0) {
      return new Response(
        JSON.stringify({ error: "At least one required category is needed" }),
        { status: 400 }
      )
    }

    // Validate required_categories structure
    for (const req of body.required_categories) {
      if (!req.category || typeof req.minCount !== "number" || req.minCount < 1) {
        return new Response(
          JSON.stringify({
            error: "Each required category must have a category name and minCount >= 1",
          }),
          { status: 400 }
        )
      }
    }

    const result = await db.query(
      `INSERT INTO discussion_templates (
        name, description, category,
        is_system, is_public,
        goal_text, expected_outcome,
        required_categories, optional_categories, category_flow, milestones,
        completion_mode, require_approval, min_approvers,
        icon_name, color_scheme,
        created_by, org_id
      ) VALUES (
        $1, $2, $3,
        false, $4,
        $5, $6,
        $7, $8, $9, $10,
        $11, $12, $13,
        $14, $15,
        $16, $17
      ) RETURNING *`,
      [
        body.name.trim(),
        body.description?.trim() || null,
        body.category.trim(),
        body.is_public !== false, // Default to public
        body.goal_text?.trim() || null,
        body.expected_outcome?.trim() || null,
        JSON.stringify(body.required_categories),
        JSON.stringify(body.optional_categories || []),
        JSON.stringify(body.category_flow || []),
        JSON.stringify(body.milestones || []),
        body.completion_mode || "checklist",
        body.require_approval || false,
        body.min_approvers || 1,
        body.icon_name || null,
        body.color_scheme || null,
        authResult.user.id,
        orgContext?.orgId || null,
      ]
    )

    const template = result.rows[0]

    return new Response(
      JSON.stringify({
        template: {
          id: template.id,
          name: template.name,
          description: template.description,
          category: template.category,
          is_system: template.is_system,
          is_public: template.is_public,
          goal_text: template.goal_text,
          expected_outcome: template.expected_outcome,
          required_categories: template.required_categories || [],
          optional_categories: template.optional_categories || [],
          category_flow: template.category_flow || [],
          milestones: template.milestones || [],
          completion_mode: template.completion_mode,
          auto_complete_threshold: template.auto_complete_threshold,
          require_approval: template.require_approval,
          min_approvers: template.min_approvers,
          approval_roles: template.approval_roles || [],
          icon_name: template.icon_name,
          color_scheme: template.color_scheme,
          use_count: template.use_count,
          created_by: template.created_by,
          org_id: template.org_id,
          created_at: template.created_at,
          updated_at: template.updated_at,
        },
      }),
      { status: 201 }
    )
  } catch (error) {
    return handleApiError(error)
  }
}

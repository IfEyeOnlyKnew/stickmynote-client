// v2 Social Sticks Discussion Template API: Assign/manage template for a stick
import { type NextRequest } from "next/server"
import { db } from "@/lib/database/pg-client"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { handleApiError } from "@/lib/api/handle-api-error"
import { calculateTemplateProgress } from "@/lib/discussion-templates/progress-calculator"
import type { DiscussionTemplate, StickDiscussionTemplate, TemplateProgress } from "@/types/discussion-templates"

export const dynamic = "force-dynamic"

interface Reply {
  id: string
  category?: string | null
  parent_reply_id?: string | null
  created_at: string
}

// GET /api/v2/social-sticks/[stickId]/discussion-template - Get assigned template and progress
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ stickId: string }> }
) {
  try {
    const { stickId } = await params

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

    // Get assignment with template details
    const assignmentResult = await db.query(
      `SELECT
        sdt.id, sdt.social_stick_id, sdt.discussion_template_id, sdt.org_id,
        sdt.is_active, sdt.completion_percentage, sdt.completed_at,
        sdt.checklist_state, sdt.milestone_state, sdt.approval_state,
        sdt.assigned_by, sdt.assigned_at, sdt.created_at, sdt.updated_at,
        dt.id as template_id, dt.name, dt.description, dt.category,
        dt.is_system, dt.is_public, dt.goal_text, dt.expected_outcome,
        dt.required_categories, dt.optional_categories, dt.category_flow, dt.milestones,
        dt.completion_mode, dt.auto_complete_threshold,
        dt.require_approval, dt.min_approvers, dt.approval_roles,
        dt.icon_name, dt.color_scheme, dt.use_count
      FROM stick_discussion_templates sdt
      JOIN discussion_templates dt ON sdt.discussion_template_id = dt.id
      WHERE sdt.social_stick_id = $1 AND sdt.is_active = true`,
      [stickId]
    )

    if (assignmentResult.rows.length === 0) {
      return new Response(
        JSON.stringify({ assignment: null, progress: null }),
        { status: 200 }
      )
    }

    const row = assignmentResult.rows[0]

    // Build template object
    const template: DiscussionTemplate = {
      id: row.template_id,
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
      created_by: null,
      org_id: null,
      created_at: "",
      updated_at: "",
    }

    // Get current replies for progress calculation
    const repliesResult = await db.query(
      `SELECT id, category, parent_reply_id, created_at
       FROM social_stick_replies
       WHERE social_stick_id = $1
       ORDER BY created_at ASC`,
      [stickId]
    )

    const replies: Reply[] = repliesResult.rows

    // Calculate progress
    const progress: TemplateProgress = calculateTemplateProgress(template, replies)

    const assignment: StickDiscussionTemplate = {
      id: row.id,
      social_stick_id: row.social_stick_id,
      discussion_template_id: row.discussion_template_id,
      org_id: row.org_id,
      is_active: row.is_active,
      completion_percentage: progress.completionPercentage,
      completed_at: row.completed_at,
      checklist_state: row.checklist_state || {},
      milestone_state: row.milestone_state || {},
      approval_state: row.approval_state || { approvers: [], status: "pending", requiredCount: 0 },
      assigned_by: row.assigned_by,
      assigned_at: row.assigned_at,
      template,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }

    return new Response(
      JSON.stringify({ assignment, progress }),
      { status: 200 }
    )
  } catch (error) {
    return handleApiError(error)
  }
}

// POST /api/v2/social-sticks/[stickId]/discussion-template - Assign a template
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ stickId: string }> }
) {
  try {
    const { stickId } = await params

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

    const body = await request.json()
    const { templateId } = body

    if (!templateId) {
      return new Response(JSON.stringify({ error: "templateId is required" }), { status: 400 })
    }

    // Verify the stick exists and user has access
    const stickResult = await db.query(
      `SELECT id, org_id FROM social_sticks WHERE id = $1`,
      [stickId]
    )

    if (stickResult.rows.length === 0) {
      return new Response(JSON.stringify({ error: "Stick not found" }), { status: 404 })
    }

    const stick = stickResult.rows[0]

    // Verify the template exists and user has access
    const templateResult = await db.query(
      `SELECT id, name, required_categories, milestones
       FROM discussion_templates
       WHERE id = $1
         AND (is_system = true OR is_public = true OR org_id = $2 OR created_by = $3)`,
      [templateId, orgContext?.orgId, authResult.user.id]
    )

    if (templateResult.rows.length === 0) {
      return new Response(JSON.stringify({ error: "Template not found" }), { status: 404 })
    }

    // Deactivate any existing active assignment
    await db.query(
      `UPDATE stick_discussion_templates
       SET is_active = false, updated_at = NOW()
       WHERE social_stick_id = $1 AND is_active = true`,
      [stickId]
    )

    // Create new assignment
    const result = await db.query(
      `INSERT INTO stick_discussion_templates (
        social_stick_id, discussion_template_id, org_id,
        is_active, completion_percentage,
        checklist_state, milestone_state, approval_state,
        assigned_by
      ) VALUES (
        $1, $2, $3,
        true, 0,
        '{}'::jsonb, '{}'::jsonb, '{"approvers": [], "status": "pending", "requiredCount": 0}'::jsonb,
        $4
      )
      ON CONFLICT (social_stick_id, discussion_template_id)
      DO UPDATE SET
        is_active = true,
        completion_percentage = 0,
        completed_at = NULL,
        checklist_state = '{}'::jsonb,
        milestone_state = '{}'::jsonb,
        approval_state = '{"approvers": [], "status": "pending", "requiredCount": 0}'::jsonb,
        assigned_by = $4,
        assigned_at = NOW(),
        updated_at = NOW()
      RETURNING *`,
      [stickId, templateId, stick.org_id, authResult.user.id]
    )

    // Increment use_count on the template
    await db.query(
      `UPDATE discussion_templates SET use_count = use_count + 1 WHERE id = $1`,
      [templateId]
    )

    return new Response(
      JSON.stringify({ assignment: result.rows[0] }),
      { status: 201 }
    )
  } catch (error) {
    return handleApiError(error)
  }
}

// DELETE /api/v2/social-sticks/[stickId]/discussion-template - Remove template assignment
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ stickId: string }> }
) {
  try {
    const { stickId } = await params

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

    // Deactivate the assignment (soft delete)
    const result = await db.query(
      `UPDATE stick_discussion_templates
       SET is_active = false, updated_at = NOW()
       WHERE social_stick_id = $1 AND is_active = true
       RETURNING id`,
      [stickId]
    )

    if (result.rows.length === 0) {
      return new Response(
        JSON.stringify({ error: "No active template assignment found" }),
        { status: 404 }
      )
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

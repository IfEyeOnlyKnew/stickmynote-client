-- Discussion Templates Feature
-- Creates tables for discussion templates with completion checklists and guided prompts

-- Table: discussion_templates
-- Stores template definitions for guided discussions
CREATE TABLE IF NOT EXISTS discussion_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL,  -- e.g., 'Problem Solving', 'Decision Making', 'Feature Request', 'Incident Response'

    -- Template Settings
    is_system BOOLEAN DEFAULT false,
    is_public BOOLEAN DEFAULT true,

    -- Goals and Outcomes
    goal_text TEXT,
    expected_outcome TEXT,

    -- Category Requirements (JSONB for flexibility)
    required_categories JSONB NOT NULL DEFAULT '[]'::jsonb,
    -- Format: [{ "category": "Answer", "minCount": 1, "description": "At least one answer must be provided" }]

    optional_categories JSONB DEFAULT '[]'::jsonb,
    -- Format: [{ "category": "Feedback", "suggestAfter": "Answer", "suggestWhen": "always", "prompt": "Consider adding feedback" }]

    category_flow JSONB DEFAULT '[]'::jsonb,
    -- Format: [{ "step": 1, "category": "Clarification", "label": "Gather Details", "description": "..." }]

    milestones JSONB DEFAULT '[]'::jsonb,
    -- Format: [{ "id": "uuid", "name": "Solution Proposed", "triggerCategories": ["Answer"], "minReplies": 1 }]

    -- Completion Settings
    completion_mode TEXT DEFAULT 'checklist',  -- 'checklist', 'approval', 'auto'
    auto_complete_threshold INTEGER DEFAULT 100,  -- Percentage for auto-complete mode

    -- Approval Settings
    require_approval BOOLEAN DEFAULT false,
    min_approvers INTEGER DEFAULT 1,
    approval_roles JSONB DEFAULT '["admin", "owner"]'::jsonb,

    -- Visual Settings
    icon_name TEXT,
    color_scheme TEXT,

    -- Tracking
    use_count INTEGER DEFAULT 0,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for discussion_templates
CREATE INDEX IF NOT EXISTS idx_discussion_templates_category ON discussion_templates(category);
CREATE INDEX IF NOT EXISTS idx_discussion_templates_org ON discussion_templates(org_id);
CREATE INDEX IF NOT EXISTS idx_discussion_templates_system ON discussion_templates(is_system) WHERE is_system = true;
CREATE INDEX IF NOT EXISTS idx_discussion_templates_public ON discussion_templates(is_public) WHERE is_public = true;
CREATE INDEX IF NOT EXISTS idx_discussion_templates_created_by ON discussion_templates(created_by);

-- Table: stick_discussion_templates
-- Junction table tracking which templates are assigned to which sticks
CREATE TABLE IF NOT EXISTS stick_discussion_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    social_stick_id UUID NOT NULL REFERENCES social_sticks(id) ON DELETE CASCADE,
    discussion_template_id UUID NOT NULL REFERENCES discussion_templates(id) ON DELETE CASCADE,
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,

    -- Status
    is_active BOOLEAN DEFAULT true,
    completion_percentage INTEGER DEFAULT 0,
    completed_at TIMESTAMPTZ,

    -- Progress Tracking (JSONB for flexibility)
    checklist_state JSONB DEFAULT '{}'::jsonb,
    -- Format: { "Answer": { "count": 2, "fulfilled": true, "firstAt": "timestamp", "replyIds": ["id1", "id2"] } }

    milestone_state JSONB DEFAULT '{}'::jsonb,
    -- Format: { "milestone_id": { "reached": true, "reachedAt": "timestamp", "triggeredBy": "reply_id" } }

    approval_state JSONB DEFAULT '{}'::jsonb,
    -- Format: { "approvers": [{ "userId": "...", "approvedAt": "...", "comment": "...", "type": "approve" }], "status": "pending" }

    -- Assignment Info
    assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
    assigned_at TIMESTAMPTZ DEFAULT NOW(),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(social_stick_id, discussion_template_id)
);

-- Indexes for stick_discussion_templates
CREATE INDEX IF NOT EXISTS idx_stick_disc_templates_stick ON stick_discussion_templates(social_stick_id);
CREATE INDEX IF NOT EXISTS idx_stick_disc_templates_template ON stick_discussion_templates(discussion_template_id);
CREATE INDEX IF NOT EXISTS idx_stick_disc_templates_active ON stick_discussion_templates(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_stick_disc_templates_org ON stick_discussion_templates(org_id);
CREATE INDEX IF NOT EXISTS idx_stick_disc_templates_assigned_by ON stick_discussion_templates(assigned_by);

-- Table: discussion_template_approvals
-- Individual approval records for templates requiring approval
CREATE TABLE IF NOT EXISTS discussion_template_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stick_discussion_template_id UUID NOT NULL REFERENCES stick_discussion_templates(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,

    approval_type TEXT DEFAULT 'approve',  -- 'approve', 'reject', 'request_changes'
    comment TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(stick_discussion_template_id, user_id)
);

-- Indexes for discussion_template_approvals
CREATE INDEX IF NOT EXISTS idx_disc_approvals_template ON discussion_template_approvals(stick_discussion_template_id);
CREATE INDEX IF NOT EXISTS idx_disc_approvals_user ON discussion_template_approvals(user_id);
CREATE INDEX IF NOT EXISTS idx_disc_approvals_org ON discussion_template_approvals(org_id);

-- Note: RLS is NOT enabled for these tables.
-- Authorization is handled at the API layer via getCachedAuthUser() and getOrgContext().
-- This database does not use Supabase auth schema, so auth.uid() is not available.

-- Trigger for updated_at on discussion_templates
CREATE OR REPLACE FUNCTION update_discussion_templates_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS discussion_templates_timestamp ON discussion_templates;
CREATE TRIGGER discussion_templates_timestamp
    BEFORE UPDATE ON discussion_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_discussion_templates_timestamp();

-- Trigger for updated_at on stick_discussion_templates
CREATE OR REPLACE FUNCTION update_stick_discussion_templates_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS stick_discussion_templates_timestamp ON stick_discussion_templates;
CREATE TRIGGER stick_discussion_templates_timestamp
    BEFORE UPDATE ON stick_discussion_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_stick_discussion_templates_timestamp();

-- Comments for documentation
COMMENT ON TABLE discussion_templates IS 'Stores discussion template definitions with category requirements and guided prompts';
COMMENT ON TABLE stick_discussion_templates IS 'Tracks which discussion templates are assigned to which sticks and their progress';
COMMENT ON TABLE discussion_template_approvals IS 'Individual approval records for templates requiring approval before resolution';

COMMENT ON COLUMN discussion_templates.required_categories IS 'JSONB array of required categories with minCount and description';
COMMENT ON COLUMN discussion_templates.optional_categories IS 'JSONB array of optional categories with suggestion prompts';
COMMENT ON COLUMN discussion_templates.category_flow IS 'JSONB array defining the recommended order of categories';
COMMENT ON COLUMN discussion_templates.milestones IS 'JSONB array defining milestone triggers and requirements';
COMMENT ON COLUMN discussion_templates.completion_mode IS 'How completion is determined: checklist, approval, or auto';

COMMENT ON COLUMN stick_discussion_templates.checklist_state IS 'JSONB tracking which categories have been fulfilled';
COMMENT ON COLUMN stick_discussion_templates.milestone_state IS 'JSONB tracking which milestones have been reached';
COMMENT ON COLUMN stick_discussion_templates.approval_state IS 'JSONB tracking approval workflow state';

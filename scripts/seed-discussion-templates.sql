-- Seed Discussion Templates - System templates for guided discussions

-- Clear existing system templates (for re-running)
DELETE FROM discussion_templates WHERE is_system = true;

-- Problem Solving Template
INSERT INTO discussion_templates (
    name, description, category,
    is_system, is_public,
    goal_text, expected_outcome,
    required_categories, optional_categories, category_flow, milestones,
    completion_mode, require_approval, min_approvers,
    icon_name, color_scheme
) VALUES (
    'Problem Solving',
    'Structured approach to identify, analyze, and resolve issues collaboratively',
    'Problem Solving',
    true, true,
    'Identify the root cause and implement a verified solution',
    'Problem resolved with documented solution and verification',
    '[
        {"category": "Clarification", "minCount": 1, "description": "Gather details about the problem"},
        {"category": "Answer", "minCount": 1, "description": "Proposed solution must be provided"},
        {"category": "Status Update", "minCount": 1, "description": "Confirm resolution status"}
    ]'::jsonb,
    '[
        {"category": "Bug Report", "suggestWhen": "always", "prompt": "Document specific issues found during investigation"},
        {"category": "Reference", "suggestAfter": "Answer", "prompt": "Add supporting documentation or links"}
    ]'::jsonb,
    '[
        {"step": 1, "category": "Clarification", "label": "Understand the Problem", "description": "Gather context and details"},
        {"step": 2, "category": "Bug Report", "label": "Document Issues", "description": "Record specific problems identified"},
        {"step": 3, "category": "Answer", "label": "Propose Solution", "description": "Suggest a fix or workaround"},
        {"step": 4, "category": "Status Update", "label": "Verify Resolution", "description": "Confirm the solution works"}
    ]'::jsonb,
    '[
        {"id": "problem-understood", "name": "Problem Understood", "description": "Initial problem details gathered", "triggerCategories": ["Clarification"], "minReplies": 1},
        {"id": "solution-proposed", "name": "Solution Proposed", "description": "A potential solution has been suggested", "triggerCategories": ["Answer"], "minReplies": 1}
    ]'::jsonb,
    'checklist', false, 1,
    'wrench', 'blue'
);

-- Decision Making Template
INSERT INTO discussion_templates (
    name, description, category,
    is_system, is_public,
    goal_text, expected_outcome,
    required_categories, optional_categories, category_flow, milestones,
    completion_mode, require_approval, min_approvers,
    icon_name, color_scheme
) VALUES (
    'Decision Making',
    'Collaborative decision process with options evaluation and consensus building',
    'Decision Making',
    true, true,
    'Evaluate options and reach a documented decision with buy-in',
    'Clear decision with rationale recorded and stakeholder approval',
    '[
        {"category": "Opinion", "minCount": 2, "description": "Multiple perspectives are needed for good decisions"},
        {"category": "Answer", "minCount": 1, "description": "Final decision statement required"}
    ]'::jsonb,
    '[
        {"category": "Reference", "suggestWhen": "always", "prompt": "Add supporting data, research, or precedents"},
        {"category": "Feedback", "suggestAfter": "Answer", "prompt": "Provide feedback on the proposed decision"},
        {"category": "Clarification", "suggestWhen": "missing", "prompt": "Clarify the decision criteria or constraints"}
    ]'::jsonb,
    '[
        {"step": 1, "category": "Clarification", "label": "Define Decision Scope", "description": "Clarify what needs to be decided"},
        {"step": 2, "category": "Opinion", "label": "Gather Perspectives", "description": "Collect viewpoints from stakeholders"},
        {"step": 3, "category": "Reference", "label": "Review Evidence", "description": "Consider data and precedents"},
        {"step": 4, "category": "Answer", "label": "Document Decision", "description": "Record the final decision"}
    ]'::jsonb,
    '[
        {"id": "perspectives-gathered", "name": "Perspectives Gathered", "description": "Multiple viewpoints have been shared", "triggerCategories": ["Opinion"], "minReplies": 2},
        {"id": "decision-made", "name": "Decision Made", "description": "A final decision has been documented", "triggerCategories": ["Answer"], "minReplies": 1}
    ]'::jsonb,
    'approval', true, 1,
    'scale', 'purple'
);

-- Feature Request Template
INSERT INTO discussion_templates (
    name, description, category,
    is_system, is_public,
    goal_text, expected_outcome,
    required_categories, optional_categories, category_flow, milestones,
    completion_mode, require_approval, min_approvers,
    icon_name, color_scheme
) VALUES (
    'Feature Request',
    'Track feature requests from idea to implementation decision',
    'Feature Request',
    true, true,
    'Evaluate feature request and determine implementation path',
    'Feature approved/rejected with clear next steps documented',
    '[
        {"category": "Use Case", "minCount": 1, "description": "Describe the use case and user need"},
        {"category": "Feedback", "minCount": 1, "description": "Community or stakeholder feedback required"},
        {"category": "Status Update", "minCount": 1, "description": "Implementation decision needed"}
    ]'::jsonb,
    '[
        {"category": "Enhancement Request", "suggestWhen": "always", "prompt": "Suggest refinements or alternative approaches"},
        {"category": "Reference", "suggestAfter": "Use Case", "prompt": "Add examples, mockups, or similar implementations"},
        {"category": "Opinion", "suggestWhen": "missing", "prompt": "Share your thoughts on the feature value"}
    ]'::jsonb,
    '[
        {"step": 1, "category": "Use Case", "label": "Describe Need", "description": "Explain the problem this solves"},
        {"step": 2, "category": "Clarification", "label": "Gather Requirements", "description": "Define scope and constraints"},
        {"step": 3, "category": "Feedback", "label": "Community Input", "description": "Collect stakeholder feedback"},
        {"step": 4, "category": "Status Update", "label": "Decision", "description": "Approve, reject, or defer"}
    ]'::jsonb,
    '[
        {"id": "requirements-clear", "name": "Requirements Clear", "description": "Use case and requirements are defined", "triggerCategories": ["Use Case", "Clarification"], "minReplies": 2},
        {"id": "feedback-collected", "name": "Feedback Collected", "description": "Stakeholder feedback has been gathered", "triggerCategories": ["Feedback"], "minReplies": 1}
    ]'::jsonb,
    'checklist', false, 1,
    'lightbulb', 'amber'
);

-- Incident Response Template
INSERT INTO discussion_templates (
    name, description, category,
    is_system, is_public,
    goal_text, expected_outcome,
    required_categories, optional_categories, category_flow, milestones,
    completion_mode, require_approval, min_approvers,
    icon_name, color_scheme
) VALUES (
    'Incident Response',
    'Structured incident management from detection to resolution and post-mortem',
    'Incident Response',
    true, true,
    'Resolve incident quickly and document learnings for prevention',
    'Incident resolved with root cause identified and prevention measures documented',
    '[
        {"category": "Bug Report", "minCount": 1, "description": "Initial incident report with impact assessment"},
        {"category": "Status Update", "minCount": 2, "description": "Track investigation progress and resolution"},
        {"category": "Correction", "minCount": 1, "description": "Document the fix that was applied"}
    ]'::jsonb,
    '[
        {"category": "Reference", "suggestWhen": "always", "prompt": "Link to logs, monitoring dashboards, or alerts"},
        {"category": "FAQ", "suggestAfter": "Correction", "prompt": "Add to FAQ if this is a recurring issue"},
        {"category": "Clarification", "suggestWhen": "missing", "prompt": "Clarify the scope and impact of the incident"}
    ]'::jsonb,
    '[
        {"step": 1, "category": "Bug Report", "label": "Report Incident", "description": "Document what happened and the impact"},
        {"step": 2, "category": "Status Update", "label": "Investigate", "description": "Track investigation progress"},
        {"step": 3, "category": "Correction", "label": "Apply Fix", "description": "Implement and document the solution"},
        {"step": 4, "category": "Status Update", "label": "Verify & Close", "description": "Confirm resolution and close incident"}
    ]'::jsonb,
    '[
        {"id": "root-cause-identified", "name": "Root Cause Identified", "description": "The source of the incident has been found", "triggerCategories": ["Clarification", "Bug Report"], "minReplies": 1},
        {"id": "fix-applied", "name": "Fix Applied", "description": "A correction has been implemented", "triggerCategories": ["Correction"], "minReplies": 1},
        {"id": "resolution-verified", "name": "Resolution Verified", "description": "The fix has been verified and incident closed", "triggerCategories": ["Status Update"], "minReplies": 2}
    ]'::jsonb,
    'checklist', false, 1,
    'alert-triangle', 'red'
);

-- General Discussion Template
INSERT INTO discussion_templates (
    name, description, category,
    is_system, is_public,
    goal_text, expected_outcome,
    required_categories, optional_categories, category_flow, milestones,
    completion_mode, require_approval, min_approvers,
    icon_name, color_scheme
) VALUES (
    'General Discussion',
    'Open-ended discussion for brainstorming and knowledge sharing',
    'General',
    true, true,
    'Facilitate productive discussion and capture insights',
    'Discussion concluded with key points summarized',
    '[
        {"category": "Feedback", "minCount": 1, "description": "At least one response is needed"}
    ]'::jsonb,
    '[
        {"category": "Answer", "suggestWhen": "missing", "prompt": "Provide a direct response or conclusion"},
        {"category": "Reference", "suggestWhen": "always", "prompt": "Share relevant resources or examples"},
        {"category": "Opinion", "suggestWhen": "always", "prompt": "Share your perspective on the topic"}
    ]'::jsonb,
    '[
        {"step": 1, "category": "Feedback", "label": "Initial Responses", "description": "Share initial thoughts"},
        {"step": 2, "category": "Opinion", "label": "Perspectives", "description": "Gather different viewpoints"},
        {"step": 3, "category": "Answer", "label": "Conclusions", "description": "Summarize key points"}
    ]'::jsonb,
    '[
        {"id": "discussion-started", "name": "Discussion Started", "description": "Initial responses have been shared", "triggerCategories": ["Feedback", "Opinion"], "minReplies": 1}
    ]'::jsonb,
    'checklist', false, 1,
    'message-square', 'gray'
);

-- Verify templates were created
SELECT id, name, category, is_system FROM discussion_templates WHERE is_system = true ORDER BY name;

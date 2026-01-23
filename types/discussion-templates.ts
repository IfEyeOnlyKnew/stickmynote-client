// Discussion Templates Types
// Defines types for guided discussion flows with completion checklists and prompts

/**
 * Required category for a discussion template
 */
export interface RequiredCategory {
  category: string
  minCount: number
  description: string
}

/**
 * Optional category with suggestion prompts
 */
export interface OptionalCategory {
  category: string
  suggestAfter?: string // Suggest after this category appears
  suggestWhen?: "always" | "missing" | "after_required"
  prompt: string
}

/**
 * Step in the category flow
 */
export interface CategoryFlowStep {
  step: number
  category: string
  label: string
  description?: string
}

/**
 * Milestone definition for tracking discussion progress
 */
export interface Milestone {
  id: string
  name: string
  description?: string
  triggerCategories: string[]
  minReplies?: number
  requiredCategories?: string[]
}

/**
 * State of a milestone (reached or not)
 */
export interface MilestoneState {
  reached: boolean
  reachedAt?: string
  triggeredBy?: string // Reply ID that triggered it
}

/**
 * State of a category checklist item
 */
export interface CategoryChecklistItem {
  count: number
  fulfilled: boolean
  firstAt?: string
  replyIds: string[]
}

/**
 * Record of an approver's action
 */
export interface ApproverRecord {
  userId: string
  userName?: string
  userEmail?: string
  approvedAt: string
  comment?: string
  type: "approve" | "reject" | "request_changes"
}

/**
 * State of the approval workflow
 */
export interface ApprovalState {
  approvers: ApproverRecord[]
  status: "pending" | "approved" | "rejected" | "changes_requested"
  requiredCount: number
}

/**
 * Completion mode for a discussion template
 */
export type CompletionMode = "checklist" | "approval" | "auto"

/**
 * Discussion template definition
 */
export interface DiscussionTemplate {
  id: string
  name: string
  description: string | null
  category: string

  is_system: boolean
  is_public: boolean

  goal_text: string | null
  expected_outcome: string | null

  required_categories: RequiredCategory[]
  optional_categories: OptionalCategory[]
  category_flow: CategoryFlowStep[]
  milestones: Milestone[]

  completion_mode: CompletionMode
  auto_complete_threshold: number

  require_approval: boolean
  min_approvers: number
  approval_roles: string[]

  icon_name: string | null
  color_scheme: string | null
  use_count: number
  created_by: string | null
  org_id: string | null

  created_at: string
  updated_at: string
}

/**
 * Assignment of a discussion template to a stick
 */
export interface StickDiscussionTemplate {
  id: string
  social_stick_id: string
  discussion_template_id: string
  org_id: string | null

  is_active: boolean
  completion_percentage: number
  completed_at: string | null

  checklist_state: Record<string, CategoryChecklistItem>
  milestone_state: Record<string, MilestoneState>
  approval_state: ApprovalState

  assigned_by: string | null
  assigned_at: string

  // Joined data
  template?: DiscussionTemplate

  created_at: string
  updated_at: string
}

/**
 * Guided prompt to suggest a reply category
 */
export interface GuidedPrompt {
  category: string
  prompt: string
  priority: "high" | "medium" | "low"
  reason: "required" | "suggested" | "flow"
}

/**
 * Progress information for a template assignment
 */
export interface TemplateProgress {
  templateId: string
  templateName: string
  goalText: string | null
  completionPercentage: number
  fulfilledCategories: string[]
  missingCategories: RequiredCategory[]
  suggestedPrompts: GuidedPrompt[]
  milestones: Array<Milestone & { state: MilestoneState }>
  canResolve: boolean
  blockingReasons: string[]
}

/**
 * Category for organizing templates
 */
export interface TemplateCategory {
  name: string
  count: number
  icon?: string
}

/**
 * Request to assign a template to a stick
 */
export interface AssignTemplateRequest {
  templateId: string
}

/**
 * Request to create a new discussion template
 */
export interface CreateTemplateRequest {
  name: string
  description?: string
  category: string
  goal_text?: string
  expected_outcome?: string
  required_categories: RequiredCategory[]
  optional_categories?: OptionalCategory[]
  category_flow?: CategoryFlowStep[]
  milestones?: Milestone[]
  completion_mode?: CompletionMode
  require_approval?: boolean
  min_approvers?: number
  icon_name?: string
  color_scheme?: string
  is_public?: boolean
}

/**
 * Request to update a discussion template
 */
export interface UpdateTemplateRequest {
  name?: string
  description?: string
  category?: string
  goal_text?: string
  expected_outcome?: string
  required_categories?: RequiredCategory[]
  optional_categories?: OptionalCategory[]
  category_flow?: CategoryFlowStep[]
  milestones?: Milestone[]
  completion_mode?: CompletionMode
  require_approval?: boolean
  min_approvers?: number
  icon_name?: string
  color_scheme?: string
  is_public?: boolean
}

/**
 * System template identifiers
 */
export const SYSTEM_TEMPLATE_IDS = {
  PROBLEM_SOLVING: "problem-solving",
  DECISION_MAKING: "decision-making",
  FEATURE_REQUEST: "feature-request",
  INCIDENT_RESPONSE: "incident-response",
} as const

/**
 * Template category options
 */
export const TEMPLATE_CATEGORIES = [
  { value: "Problem Solving", label: "Problem Solving", icon: "wrench" },
  { value: "Decision Making", label: "Decision Making", icon: "scale" },
  { value: "Feature Request", label: "Feature Request", icon: "lightbulb" },
  { value: "Incident Response", label: "Incident Response", icon: "alert-triangle" },
  { value: "General", label: "General", icon: "message-square" },
  { value: "Custom", label: "Custom", icon: "settings" },
] as const

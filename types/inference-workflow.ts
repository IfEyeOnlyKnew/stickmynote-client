// Workflow state types for Inference-CalSticks integration

export type WorkflowStatus = "idea" | "triage" | "in_progress" | "resolved"

export interface WorkflowConfig {
  status: WorkflowStatus
  label: string
  color: string
  bgColor: string
  borderColor: string
  description: string
}

export const WORKFLOW_STATUSES: Record<WorkflowStatus, WorkflowConfig> = {
  idea: {
    status: "idea",
    label: "Idea",
    color: "text-blue-700",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
    description: "New concept or suggestion",
  },
  triage: {
    status: "triage",
    label: "Triage",
    color: "text-amber-700",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200",
    description: "Being evaluated and prioritized",
  },
  in_progress: {
    status: "in_progress",
    label: "In Progress",
    color: "text-purple-700",
    bgColor: "bg-purple-50",
    borderColor: "border-purple-200",
    description: "Actively being worked on",
  },
  resolved: {
    status: "resolved",
    label: "Resolved",
    color: "text-green-700",
    bgColor: "bg-green-50",
    borderColor: "border-green-200",
    description: "Completed or closed",
  },
}

export const WORKFLOW_ORDER: WorkflowStatus[] = ["idea", "triage", "in_progress", "resolved"]

export interface InferenceStickWithWorkflow {
  id: string
  topic: string
  content: string
  color: string
  social_pad_id: string
  user_id: string
  created_at: string
  updated_at?: string
  workflow_status: WorkflowStatus
  workflow_owner_id: string | null
  workflow_due_date: string | null
  workflow_updated_at: string | null
  calstick_id: string | null
  promoted_at: string | null
  promoted_by: string | null
  // Relations
  workflow_owner?: {
    id: string
    full_name: string | null
    email: string
    avatar_url: string | null
  } | null
  calstick?: {
    id: string
    calstick_status: string | null
    calstick_priority: string | null
    calstick_completed: boolean
    calstick_date: string | null
    calstick_start_date: string | null
  } | null
  users?: {
    id: string
    full_name: string | null
    email: string
    avatar_url?: string | null
  } | null
  reply_count?: number
  live_summary?: string
}

export interface PromoteToCalStickRequest {
  stickId: string
  priority?: string
  dueDate?: string
  assigneeId?: string
}

export interface PromoteToCalStickResponse {
  success: boolean
  calstickId: string
  stickId: string
}

export interface WorkflowUpdateRequest {
  stickId: string
  status?: WorkflowStatus
  ownerId?: string | null
  dueDate?: string | null
}

// Analytics types for Decision Cockpit
export interface WorkflowMetrics {
  byStatus: Record<WorkflowStatus, number>
  avgTimeToResolution: number // in hours
  stuckThreads: number // threads with no activity > 48h
  needsOwner: number // threads without owner
  criticalUnresolved: number // high-priority unresolved
  promotedToCalSticks: number
}

export interface TrendData {
  date: string
  sticksCreated: number
  repliesPosted: number
  promotedToCalSticks: number
  resolved: number
}

export interface ContributorDiversity {
  totalContributors: number
  byRole: Record<string, number>
  topContributors: Array<{
    userId: string
    userName: string | null
    userEmail: string
    stickCount: number
    replyCount: number
  }>
}

export interface AttentionFilter {
  id: string
  label: string
  count: number
  icon: string
  filter: (sticks: InferenceStickWithWorkflow[]) => InferenceStickWithWorkflow[]
}

export interface PadHealthMetrics {
  padId: string
  padName: string
  sticksTotal: number
  sticksByStatus: Record<WorkflowStatus, number>
  avgResponseTime: number // hours
  slaCompliance: number // percentage
  healthScore: number // 0-100
}

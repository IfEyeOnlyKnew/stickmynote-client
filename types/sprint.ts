export type SprintStatus = "planning" | "active" | "completed" | "cancelled"

export interface Sprint {
  id: string
  org_id: string
  name: string
  goal: string | null
  start_date: string
  end_date: string
  status: SprintStatus
  velocity_planned: number
  velocity_completed: number
  created_by: string | null
  created_at: string
  updated_at: string
  // Computed fields (not stored in DB)
  tasks_count?: number
  completed_tasks_count?: number
  total_story_points?: number
  completed_story_points?: number
}

export interface SprintBurndownSnapshot {
  id: string
  sprint_id: string
  snapshot_date: string
  total_points: number
  completed_points: number
  remaining_points: number
  tasks_total: number
  tasks_completed: number
  created_at: string
}

export interface SprintBurndownData {
  sprint: Sprint
  snapshots: SprintBurndownSnapshot[]
  idealBurndown: { date: string; points: number }[]
  currentProgress: {
    totalPoints: number
    completedPoints: number
    remainingPoints: number
    daysRemaining: number
    percentComplete: number
  }
}

export interface SprintVelocity {
  sprintId: string
  sprintName: string
  plannedPoints: number
  completedPoints: number
  startDate: string
  endDate: string
}

export interface VelocityTrend {
  sprints: SprintVelocity[]
  averageVelocity: number
  trend: "increasing" | "decreasing" | "stable"
}

export interface CreateSprintInput {
  name: string
  goal?: string
  start_date: string
  end_date: string
  velocity_planned?: number
}

export interface UpdateSprintInput {
  name?: string
  goal?: string
  start_date?: string
  end_date?: string
  status?: SprintStatus
  velocity_planned?: number
  velocity_completed?: number
}

// Sprint Retrospective Types
export type RetrospectiveStatus = "draft" | "in_progress" | "completed"

export interface RetrospectiveItem {
  id: string
  text: string
  votes: number
  author_id?: string
  author_name?: string
  created_at?: string
}

export interface ActionItem {
  id: string
  text: string
  assignee_id?: string
  assignee_name?: string
  due_date?: string
  completed: boolean
  completed_at?: string
  created_at?: string
}

export interface SprintRetrospective {
  id: string
  sprint_id: string
  org_id?: string
  went_well: RetrospectiveItem[]
  to_improve: RetrospectiveItem[]
  action_items: ActionItem[]
  facilitator_id?: string
  facilitator_name?: string
  meeting_date?: string
  meeting_notes?: string
  duration_minutes?: number
  participants: string[]
  team_mood_score?: number
  status: RetrospectiveStatus
  created_at: string
  updated_at: string
  completed_at?: string
  created_by?: string
  // Joined data
  sprint?: Sprint
}

export interface CreateRetrospectiveInput {
  sprint_id: string
  meeting_date?: string
  meeting_notes?: string
  facilitator_id?: string
}

export interface UpdateRetrospectiveInput {
  went_well?: RetrospectiveItem[]
  to_improve?: RetrospectiveItem[]
  action_items?: ActionItem[]
  meeting_notes?: string
  duration_minutes?: number
  participants?: string[]
  team_mood_score?: number
  status?: RetrospectiveStatus
}

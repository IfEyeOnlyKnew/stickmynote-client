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

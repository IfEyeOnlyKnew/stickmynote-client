export interface ChecklistItem {
  id: string
  text: string
  completed: boolean
  order: number
  created_at?: string
  completed_at?: string | null
}

export interface ChecklistData {
  items: ChecklistItem[]
}

export interface SubtaskProgress {
  total: number
  completed: number
  percentage: number
}

export interface TaskProgress {
  checklist: {
    total: number
    completed: number
    percentage: number
  }
  subtasks: {
    total: number
    completed: number
    percentage: number
  }
  overall: number
}

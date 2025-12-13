import { z } from "zod"

export type TriggerEvent = "task_created" | "task_updated" | "task_completed" | "status_changed" | "priority_changed"
export type ActionType = "send_notification" | "send_email" | "update_task" | "create_subtask" | "assign_task"

export interface AutomationRule {
  id: string
  user_id: string
  name: string
  description?: string
  trigger_event: TriggerEvent
  trigger_conditions: Record<string, any>
  action_type: ActionType
  action_config: Record<string, any>
  is_active: boolean
  created_at: string
  updated_at: string
}

export const automationRuleSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  trigger_event: z.enum([
    "task_created",
    "task_updated",
    "task_completed",
    "status_changed",
    "priority_changed",
  ]),
  trigger_conditions: z.record(z.any()).optional(),
  action_type: z.enum([
    "send_notification",
    "send_email",
    "update_task",
    "create_subtask",
    "assign_task",
  ]),
  action_config: z.record(z.any()),
  is_active: z.boolean().optional().default(true),
})

export type RecurrenceFrequency = "daily" | "weekly" | "monthly" | "yearly"

export interface RecurringTask {
  id: string
  original_task_id: string
  user_id: string
  frequency: RecurrenceFrequency
  interval: number
  days_of_week?: number[] // 0-6
  day_of_month?: number
  end_date?: string
  next_run: string
  last_run?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export const recurringTaskSchema = z.object({
  frequency: z.enum(["daily", "weekly", "monthly", "yearly"]),
  interval: z.number().int().min(1).default(1),
  days_of_week: z.array(z.number().min(0).max(6)).optional(),
  day_of_month: z.number().min(1).max(31).optional(),
  end_date: z.string().datetime().optional(),
})

export interface TaskReminder {
  id: string
  task_id: string
  user_id: string
  remind_at: string
  reminder_type: "notification" | "email"
  message?: string
  is_sent: boolean
  sent_at?: string
  created_at: string
}

export const taskReminderSchema = z.object({
  remind_at: z.string().datetime(),
  reminder_type: z.enum(["notification", "email"]).default("notification"),
  message: z.string().optional(),
})

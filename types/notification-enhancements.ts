// Escalation Rules Types
export interface EscalationRule {
  id: string
  user_id: string
  org_id?: string
  name: string
  description?: string
  is_active: boolean
  trigger_type: "no_reply" | "unresolved" | "mention_critical" | "custom"
  trigger_conditions: {
    hours_threshold?: number
    tags?: string[]
    priority?: string
    custom_query?: string
  }
  escalation_channel: "email" | "slack" | "sms" | "webhook" | "in_app_urgent"
  channel_config: {
    slack_webhook_url?: string
    slack_channel?: string
    phone_number?: string
    webhook_url?: string
    headers?: Record<string, string>
    email_address?: string
  }
  cooldown_minutes: number
  max_escalations: number
  pad_ids: string[]
  created_at: string
  updated_at: string
}

export interface Escalation {
  id: string
  rule_id: string
  user_id: string
  entity_type: "stick" | "pad" | "reply"
  entity_id: string
  status: "pending" | "sent" | "acknowledged" | "snoozed" | "failed"
  escalation_count: number
  snoozed_until?: string
  acknowledged_at?: string
  acknowledged_by?: string
  sent_at?: string
  delivery_response?: Record<string, unknown>
  error_message?: string
  created_at: string
  updated_at: string
  rule?: Pick<EscalationRule, "id" | "name" | "trigger_type" | "escalation_channel">
}

// Webhook Types
export interface WebhookConfiguration {
  id: string
  user_id: string
  org_id?: string
  name: string
  description?: string
  url: string
  signing_secret: string
  headers: Record<string, string>
  event_types: string[]
  pad_ids: string[]
  is_active: boolean
  total_deliveries: number
  successful_deliveries: number
  failed_deliveries: number
  last_triggered_at?: string
  last_success_at?: string
  last_failure_at?: string
  created_at: string
  updated_at: string
}

export interface WebhookDeliveryLog {
  id: string
  webhook_id: string
  event_type: string
  event_id: string
  payload: Record<string, unknown>
  status: "pending" | "success" | "failed" | "retrying"
  attempt_count: number
  max_attempts: number
  response_status?: number
  response_body?: string
  response_headers?: Record<string, unknown>
  response_time_ms?: number
  error_message?: string
  scheduled_for: string
  first_attempted_at?: string
  last_attempted_at?: string
  completed_at?: string
  created_at: string
}

// Muted Items Types
export interface MutedItem {
  id: string
  user_id: string
  entity_type: "stick" | "pad" | "user" | "thread"
  entity_id: string
  muted_until?: string
  reason?: string
  created_at: string
}

// Subscription Types (enhanced)
export interface NotificationSubscription {
  id: string
  user_id: string
  entity_type: "stick" | "pad"
  entity_id: string
  channel_preferences: {
    in_app: boolean
    email: boolean
    webhook: boolean
  }
  muted_until?: string
  notification_level: "all" | "mentions" | "none"
  created_at: string
  updated_at: string
}

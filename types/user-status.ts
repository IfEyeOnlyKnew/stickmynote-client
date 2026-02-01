// ============================================================================
// USER STATUS & PRESENCE SYSTEM - TypeScript Types
// ============================================================================

// ----------------------------------------------------------------------------
// Status Types
// ----------------------------------------------------------------------------

export type UserStatusType = "online" | "away" | "busy" | "dnd" | "offline"

export interface UserStatus {
  id: string
  user_id: string
  status: UserStatusType
  custom_message: string | null
  custom_message_expires_at: string | null
  focus_mode_enabled: boolean
  focus_mode_expires_at: string | null
  auto_away_enabled: boolean
  auto_away_minutes: number
  calendar_sync_enabled: boolean
  created_at: string
  updated_at: string
}

export interface EffectiveUserStatus {
  user_id: string
  status: UserStatusType
  custom_message: string | null
  focus_mode_enabled: boolean
  is_within_working_hours: boolean
  is_online: boolean
  last_seen_at: string | null
}

// ----------------------------------------------------------------------------
// Working Hours Types
// ----------------------------------------------------------------------------

export interface WorkingHours {
  id: string
  user_id: string
  enabled: boolean
  timezone: string
  monday_start: string | null
  monday_end: string | null
  tuesday_start: string | null
  tuesday_end: string | null
  wednesday_start: string | null
  wednesday_end: string | null
  thursday_start: string | null
  thursday_end: string | null
  friday_start: string | null
  friday_end: string | null
  saturday_start: string | null
  saturday_end: string | null
  sunday_start: string | null
  sunday_end: string | null
  away_message: string | null
  created_at: string
  updated_at: string
}

export interface DaySchedule {
  start: string | null // HH:MM format
  end: string | null // HH:MM format
}

export type DayOfWeek = "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday"

// ----------------------------------------------------------------------------
// Status History Types
// ----------------------------------------------------------------------------

export interface StatusHistoryEntry {
  id: string
  user_id: string
  previous_status: UserStatusType | null
  new_status: UserStatusType
  custom_message: string | null
  duration_seconds: number | null
  created_at: string
}

// ----------------------------------------------------------------------------
// Constants & Utilities
// ----------------------------------------------------------------------------

export const STATUS_COLORS: Record<UserStatusType, string> = {
  online: "bg-green-500",
  away: "bg-yellow-500",
  busy: "bg-red-500",
  dnd: "bg-red-600",
  offline: "bg-gray-400",
}

export const STATUS_RING_COLORS: Record<UserStatusType, string> = {
  online: "ring-green-500",
  away: "ring-yellow-500",
  busy: "ring-red-500",
  dnd: "ring-red-600",
  offline: "ring-gray-400",
}

export const STATUS_TEXT_COLORS: Record<UserStatusType, string> = {
  online: "text-green-600",
  away: "text-yellow-600",
  busy: "text-red-600",
  dnd: "text-red-700",
  offline: "text-gray-500",
}

export const STATUS_LABELS: Record<UserStatusType, string> = {
  online: "Online",
  away: "Away",
  busy: "Busy",
  dnd: "Do Not Disturb",
  offline: "Offline",
}

export const STATUS_DESCRIPTIONS: Record<UserStatusType, string> = {
  online: "Available and active",
  away: "Stepped away temporarily",
  busy: "In a meeting or focused work",
  dnd: "All notifications muted",
  offline: "Not currently active",
}

export const STATUS_ICONS: Record<UserStatusType, string> = {
  online: "circle",
  away: "clock",
  busy: "minus-circle",
  dnd: "bell-off",
  offline: "circle-dashed",
}

// Preset durations for custom status expiration
export const STATUS_DURATION_PRESETS = [
  { label: "30 minutes", minutes: 30 },
  { label: "1 hour", minutes: 60 },
  { label: "2 hours", minutes: 120 },
  { label: "4 hours", minutes: 240 },
  { label: "Today", minutes: -1 }, // Special: until end of day
  { label: "Don't clear", minutes: 0 }, // 0 = no expiration
] as const

// Focus mode duration presets
export const FOCUS_MODE_PRESETS = [
  { label: "30 minutes", minutes: 30 },
  { label: "1 hour", minutes: 60 },
  { label: "2 hours", minutes: 120 },
  { label: "Until I turn it off", minutes: 0 },
] as const

// Days of week for working hours UI
export const DAYS_OF_WEEK: { key: DayOfWeek; label: string; short: string }[] = [
  { key: "monday", label: "Monday", short: "Mon" },
  { key: "tuesday", label: "Tuesday", short: "Tue" },
  { key: "wednesday", label: "Wednesday", short: "Wed" },
  { key: "thursday", label: "Thursday", short: "Thu" },
  { key: "friday", label: "Friday", short: "Fri" },
  { key: "saturday", label: "Saturday", short: "Sat" },
  { key: "sunday", label: "Sunday", short: "Sun" },
]

// Common timezones
export const COMMON_TIMEZONES = [
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "America/Anchorage", label: "Alaska Time (AKT)" },
  { value: "Pacific/Honolulu", label: "Hawaii Time (HT)" },
  { value: "UTC", label: "UTC" },
  { value: "Europe/London", label: "London (GMT/BST)" },
  { value: "Europe/Paris", label: "Paris (CET/CEST)" },
  { value: "Europe/Berlin", label: "Berlin (CET/CEST)" },
  { value: "Asia/Tokyo", label: "Tokyo (JST)" },
  { value: "Asia/Shanghai", label: "Shanghai (CST)" },
  { value: "Asia/Kolkata", label: "India (IST)" },
  { value: "Australia/Sydney", label: "Sydney (AEST/AEDT)" },
] as const

// ----------------------------------------------------------------------------
// Default Values
// ----------------------------------------------------------------------------

export const DEFAULT_USER_STATUS: Omit<UserStatus, "id" | "user_id" | "created_at" | "updated_at"> = {
  status: "online",
  custom_message: null,
  custom_message_expires_at: null,
  focus_mode_enabled: false,
  focus_mode_expires_at: null,
  auto_away_enabled: true,
  auto_away_minutes: 15,
  calendar_sync_enabled: true,
}

export const DEFAULT_WORKING_HOURS: Omit<WorkingHours, "id" | "user_id" | "created_at" | "updated_at"> = {
  enabled: false,
  timezone: "America/New_York",
  monday_start: "09:00",
  monday_end: "17:00",
  tuesday_start: "09:00",
  tuesday_end: "17:00",
  wednesday_start: "09:00",
  wednesday_end: "17:00",
  thursday_start: "09:00",
  thursday_end: "17:00",
  friday_start: "09:00",
  friday_end: "17:00",
  saturday_start: null,
  saturday_end: null,
  sunday_start: null,
  sunday_end: null,
  away_message: "I'm currently outside my working hours. I'll respond when I'm back.",
}

// ----------------------------------------------------------------------------
// API Request/Response Types
// ----------------------------------------------------------------------------

export interface UpdateStatusRequest {
  status?: UserStatusType
  custom_message?: string | null
  custom_message_expires_at?: string | null
  focus_mode_enabled?: boolean
  focus_mode_expires_at?: string | null
  auto_away_enabled?: boolean
  auto_away_minutes?: number
  calendar_sync_enabled?: boolean
}

export interface UpdateWorkingHoursRequest {
  enabled?: boolean
  timezone?: string
  monday_start?: string | null
  monday_end?: string | null
  tuesday_start?: string | null
  tuesday_end?: string | null
  wednesday_start?: string | null
  wednesday_end?: string | null
  thursday_start?: string | null
  thursday_end?: string | null
  friday_start?: string | null
  friday_end?: string | null
  saturday_start?: string | null
  saturday_end?: string | null
  sunday_start?: string | null
  sunday_end?: string | null
  away_message?: string | null
}

export interface GetStatusResponse {
  status: UserStatus | null
  effective: EffectiveUserStatus
}

export interface GetMultipleStatusResponse {
  statuses: Record<string, EffectiveUserStatus>
}

// ----------------------------------------------------------------------------
// Helper Functions
// ----------------------------------------------------------------------------

/**
 * Check if a custom message has expired
 */
export function isCustomMessageExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return false
  return new Date(expiresAt) < new Date()
}

/**
 * Check if focus mode has expired
 */
export function isFocusModeExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return false // No expiration = still active
  return new Date(expiresAt) < new Date()
}

/**
 * Calculate expiration time from minutes
 */
export function calculateExpiration(minutes: number): string | null {
  if (minutes === 0) return null // No expiration
  if (minutes === -1) {
    // End of day
    const endOfDay = new Date()
    endOfDay.setHours(23, 59, 59, 999)
    return endOfDay.toISOString()
  }
  const expiration = new Date()
  expiration.setMinutes(expiration.getMinutes() + minutes)
  return expiration.toISOString()
}

/**
 * Format time remaining until expiration
 */
export function formatTimeRemaining(expiresAt: string | null): string | null {
  if (!expiresAt) return null

  const now = new Date()
  const expiry = new Date(expiresAt)
  const diffMs = expiry.getTime() - now.getTime()

  if (diffMs <= 0) return "Expired"

  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)

  if (diffHours > 0) {
    const remainingMins = diffMins % 60
    return remainingMins > 0 ? `${diffHours}h ${remainingMins}m` : `${diffHours}h`
  }

  return `${diffMins}m`
}

/**
 * Check if current time is within a day's working hours
 */
export function isWithinDaySchedule(schedule: DaySchedule, timezone: string): boolean {
  if (!schedule.start || !schedule.end) return false

  const now = new Date()
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })

  const currentTime = formatter.format(now)
  return currentTime >= schedule.start && currentTime <= schedule.end
}

/**
 * Get the current day's working hours from a WorkingHours object
 */
export function getCurrentDaySchedule(workingHours: WorkingHours, timezone: string): DaySchedule | null {
  const now = new Date()
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "long",
  })

  const dayName = formatter.format(now).toLowerCase() as DayOfWeek

  const startKey = `${dayName}_start` as keyof WorkingHours
  const endKey = `${dayName}_end` as keyof WorkingHours

  return {
    start: workingHours[startKey] as string | null,
    end: workingHours[endKey] as string | null,
  }
}

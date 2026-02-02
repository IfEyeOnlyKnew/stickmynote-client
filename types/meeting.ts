// ============================================================================
// MEETINGS & COMMUNICATION SYSTEM - TypeScript Types
// ============================================================================

// ----------------------------------------------------------------------------
// Meeting Types
// ----------------------------------------------------------------------------

export type MeetingStatus = "scheduled" | "in_progress" | "completed" | "cancelled"

export type AttendeeStatus = "pending" | "accepted" | "declined" | "tentative"

export interface Meeting {
  id: string
  title: string
  description: string | null
  organizer_id: string
  start_time: string
  end_time: string
  video_room_id: string | null
  video_room_url: string | null
  location: string | null
  status: MeetingStatus
  // Context linking
  pad_id: string | null
  stick_id: string | null
  personal_stick_id: string | null
  created_at: string
  updated_at: string
}

export interface MeetingWithDetails extends Meeting {
  organizer?: {
    id: string
    email: string
    full_name: string | null
    avatar_url: string | null
  }
  attendees?: MeetingAttendee[]
  pad?: {
    id: string
    name: string
  }
  stick?: {
    id: string
    topic: string
  }
}

export interface MeetingAttendee {
  id: string
  meeting_id: string
  user_id: string | null
  email: string
  name: string | null
  status: AttendeeStatus
  responded_at: string | null
  created_at: string
  user?: {
    id: string
    email: string
    full_name: string | null
    avatar_url: string | null
  }
}

export interface MeetingNote {
  id: string
  meeting_id: string | null
  user_id: string
  title: string
  content: string | null
  pad_id: string | null
  stick_id: string | null
  created_at: string
  updated_at: string
  meeting?: Meeting
  user?: {
    id: string
    email: string
    full_name: string | null
  }
}

// ----------------------------------------------------------------------------
// API Request/Response Types
// ----------------------------------------------------------------------------

export interface CreateMeetingRequest {
  title: string
  description?: string
  start_time: string
  end_time: string
  attendee_emails?: string[]
  location?: string
  create_video_room?: boolean
  // Context linking
  pad_id?: string
  stick_id?: string
  personal_stick_id?: string
}

export interface UpdateMeetingRequest {
  title?: string
  description?: string
  start_time?: string
  end_time?: string
  location?: string
  status?: MeetingStatus
}

export interface CreateMeetingNoteRequest {
  title: string
  content?: string
  meeting_id?: string
  pad_id?: string
  stick_id?: string
}

export interface UpdateMeetingNoteRequest {
  title?: string
  content?: string
}

export interface GetMeetingsParams {
  start?: string
  end?: string
  pad_id?: string
  stick_id?: string
  status?: MeetingStatus
  limit?: number
  offset?: number
}

// ----------------------------------------------------------------------------
// Communication Palette Types
// ----------------------------------------------------------------------------

export type CommunicationAction =
  | "quick-call"
  | "screen-share"
  | "schedule-meeting"
  | "calendar-view"
  | "meeting-notes"

export interface CommunicationContext {
  padId?: string
  padName?: string
  stickId?: string
  stickTopic?: string
  personalStickId?: string
  members?: Array<{
    id: string
    email: string
    full_name: string | null
    avatar_url: string | null
  }>
}

export interface CommunicationPaletteState {
  isOpen: boolean
  setIsOpen: (open: boolean) => void
  context: CommunicationContext
  setContext: (context: CommunicationContext) => void
  // Active modals
  activeModal: CommunicationAction | null
  setActiveModal: (modal: CommunicationAction | null) => void
}

// ----------------------------------------------------------------------------
// Quick Call Types
// ----------------------------------------------------------------------------

export interface QuickCallOptions {
  roomName?: string
  audioOnly?: boolean
  autoScreenShare?: boolean
  inviteEmails?: string[]
  padId?: string
  stickId?: string
}

export interface QuickCallResult {
  roomId: string
  roomUrl: string
  roomName: string
}

// ----------------------------------------------------------------------------
// Calendar Quick View Types
// ----------------------------------------------------------------------------

export interface CalendarEvent {
  id: string
  title: string
  start: Date
  end: Date
  type: "meeting" | "calstick"
  color?: string
  meetingId?: string
  calstickId?: string
}

// ----------------------------------------------------------------------------
// Constants
// ----------------------------------------------------------------------------

export const MEETING_STATUS_LABELS: Record<MeetingStatus, string> = {
  scheduled: "Scheduled",
  in_progress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
}

export const MEETING_STATUS_COLORS: Record<MeetingStatus, string> = {
  scheduled: "bg-blue-100 text-blue-800",
  in_progress: "bg-green-100 text-green-800",
  completed: "bg-gray-100 text-gray-800",
  cancelled: "bg-red-100 text-red-800",
}

export const ATTENDEE_STATUS_LABELS: Record<AttendeeStatus, string> = {
  pending: "Pending",
  accepted: "Accepted",
  declined: "Declined",
  tentative: "Tentative",
}

export const ATTENDEE_STATUS_COLORS: Record<AttendeeStatus, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  accepted: "bg-green-100 text-green-800",
  declined: "bg-red-100 text-red-800",
  tentative: "bg-orange-100 text-orange-800",
}

// Default meeting duration in minutes
export const DEFAULT_MEETING_DURATION = 30

// Meeting duration presets for scheduler
export const MEETING_DURATION_PRESETS = [
  { label: "15 minutes", minutes: 15 },
  { label: "30 minutes", minutes: 30 },
  { label: "45 minutes", minutes: 45 },
  { label: "1 hour", minutes: 60 },
  { label: "1.5 hours", minutes: 90 },
  { label: "2 hours", minutes: 120 },
] as const

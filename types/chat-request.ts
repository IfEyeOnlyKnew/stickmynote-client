/**
 * Chat Request Types
 * Types for the chat invitation/request system
 */

export type ChatRequestStatus =
  | "pending"
  | "accepted"
  | "busy"
  | "schedule_meeting"
  | "give_me_5_minutes"
  | "cancelled"

export interface ChatRequestUser {
  id: string
  username?: string
  email?: string
  full_name?: string
  avatar_url?: string
}

export interface ChatRequest {
  id: string
  parent_reply_id: string
  requester_id: string
  recipient_id: string
  org_id?: string | null
  status: ChatRequestStatus
  response_message?: string | null
  wait_until?: string | null
  created_at: string
  updated_at: string
  // Populated by API
  requester?: ChatRequestUser
  recipient?: ChatRequestUser
  parent_reply?: {
    id: string
    content: string
    user?: ChatRequestUser
  }
}

export interface CreateChatRequestInput {
  parent_reply_id: string
  recipient_id?: string // Optional - can be auto-detected from reply
}

export interface UpdateChatRequestInput {
  status: ChatRequestStatus
  response_message?: string
}

export interface ChatRequestsResponse {
  requests: ChatRequest[]
  total: number
}

export interface ChatRequestResponse {
  request: ChatRequest
}

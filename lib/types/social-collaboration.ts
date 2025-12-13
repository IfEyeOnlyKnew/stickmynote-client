// Type definitions for Social Collaboration Enhancements

// ============================================
// KNOWLEDGE BASE TYPES
// ============================================

export type KBCategory =
  | "sop"
  | "playbook"
  | "pattern"
  | "tribal_knowledge"
  | "retro"
  | "glossary"
  | "decision"
  | "template"

export interface KnowledgeBaseArticle {
  id: string
  pad_id: string
  org_id: string
  title: string
  content: string
  category: KBCategory
  tags: string[]
  version: number
  created_by: string
  updated_by: string | null
  created_at: string
  updated_at: string
  view_count: number
  helpful_count: number
  citation_count: number
  metadata: Record<string, any>
}

export interface KBHistoryVersion {
  id: string
  kb_article_id: string
  version: number
  title: string
  content: string
  changed_by: string
  change_summary: string | null
  changed_at: string
}

export type CitationType = "reference" | "resolution" | "context" | "prerequisite" | "related"

export interface StickCitation {
  id: string
  stick_id: string
  org_id: string
  kb_article_id: string | null
  external_url: string | null
  external_title: string | null
  citation_type: CitationType
  note: string | null
  added_by: string
  added_at: string
}

export interface KBHelpfulVote {
  id: string
  kb_article_id: string
  user_id: string
  is_helpful: boolean
  voted_at: string
}

// ============================================
// AI SUMMARIZATION TYPES
// ============================================

export interface ActionItem {
  title: string
  owner: string
  status: "pending" | "in-progress" | "done"
  due_hint?: string
}

export interface NextQuestion {
  question: string
  priority: "high" | "medium" | "low"
}

export interface AISummaryMetadata {
  trigger_type?: "manual" | "auto_reply" | "scheduled" | "webhook"
  model_version?: string
  confidence_score?: number
  processing_time_ms?: number
}

export interface SocialStickWithAI {
  id: string
  ai_live_summary: string | null
  ai_summary_updated_at: string | null
  ai_summary_metadata: AISummaryMetadata
  ai_action_items: ActionItem[]
  ai_next_questions: NextQuestion[]
  ai_summary_version: number
}

export interface AIChangelogEntry {
  id: string
  stick_id: string
  version: number
  summary: string
  action_items: ActionItem[]
  next_questions: NextQuestion[]
  trigger_type: "manual" | "auto_reply" | "scheduled" | "webhook"
  reply_count_at_generation: number | null
  generated_at: string
  metadata: Record<string, any>
}

export interface PadQAHistory {
  id: string
  pad_id: string
  org_id: string
  question: string
  answer: string
  citations: Array<{
    stick_id: string
    topic: string
    relevance: string
  }>
  asked_by: string
  asked_at: string
  was_helpful: boolean | null
  feedback_text: string | null
}

// ============================================
// API REQUEST/RESPONSE TYPES
// ============================================

export interface CreateKBArticleRequest {
  pad_id: string
  title: string
  content: string
  category: KBCategory
  tags?: string[]
}

export interface UpdateKBArticleRequest {
  title?: string
  content?: string
  category?: KBCategory
  tags?: string[]
  change_summary?: string
}

export interface SearchKBRequest {
  pad_id: string
  query: string
  category?: KBCategory
  tags?: string[]
  limit?: number
}

export interface CreateCitationRequest {
  stick_id: string
  kb_article_id?: string
  external_url?: string
  external_title?: string
  citation_type: CitationType
  note?: string
}

export interface GenerateSummaryRequest {
  stick_id: string
  include_action_items?: boolean
  include_next_questions?: boolean
  trigger_type?: "manual" | "auto_reply"
}

export interface GenerateSummaryResponse {
  summary: string
  action_items: ActionItem[]
  next_questions: NextQuestion[]
  metadata: AISummaryMetadata
}

export interface AskPadQuestionRequest {
  pad_id: string
  question: string
  context_limit?: number
}

export interface AskPadQuestionResponse {
  answer: string
  citations: Array<{
    stick_id: string
    topic: string
    relevance: string
  }>
  qa_id: string
}

# Social Hub Collaboration Enhancements - Technical Specification

**Document Version:** 1.0  
**Last Updated:** 2025-01-06  
**Author:** v0 AI Assistant  
**Status:** Ready for Implementation

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Enhancement #1: Knowledge Base Context Panes](#enhancement-1-knowledge-base-context-panes)
3. [Enhancement #2: AI-Assisted Summarization & Q&A](#enhancement-2-ai-assisted-summarization--qa)
4. [Database Schema](#database-schema)
5. [API Endpoints](#api-endpoints)
6. [Component Architecture](#component-architecture)
7. [Integration Points](#integration-points)
8. [Security Considerations](#security-considerations)
9. [Performance Optimizations](#performance-optimizations)
10. [Implementation Phases](#implementation-phases)
11. [Testing Strategy](#testing-strategy)

---

## Executive Summary

### Purpose

This specification outlines two major enhancements to the Social Hub collaboration workspace:

1. **Knowledge Base Context Panes** - Embed contextual knowledge alongside each pad so patterns, SOPs, and tribal knowledge travel with discussions. Enable citation workflows to link sticks to prior resolutions.

2. **AI-Assisted Summarization & Q&A** - Layer intelligent summarization atop stick discussions with auto-updating briefs, action item extraction, and a conversational Q&A interface.

### Current State Analysis

The Social Hub already has:
- `social_pads` - Collaborative workspaces
- `social_sticks` - Discussion threads within pads
- `social_stick_replies` - Threaded replies on sticks
- `social_pad_members` - Role-based access control
- AI fields on `social_sticks`: `ai_summary`, `ai_sentiment`, `ai_generated_tags`, `ai_processed_at`
- Grok AI integration via `lib/ai/grok-service.ts`
- Real-time updates via `hooks/use-realtime-sticks.ts`

### Existing Database Tables (Post-Migration)

| Table | Purpose | Status |
|-------|---------|--------|
| `social_pad_knowledge_base` | KB articles storage | Created |
| `social_stick_citations` | Citation links | Created |
| `social_kb_helpful_votes` | KB article voting | Created |
| `social_kb_history` | KB version history | Created |
| `social_stick_ai_changelog` | AI summary versions | Created |
| `social_pad_qa_history` | Q&A conversation logs | Created |

---

## Enhancement #1: Knowledge Base Context Panes

### 1.1 Feature Overview

Transform each pad into a knowledge repository where institutional memory lives alongside active discussions.

### 1.2 Core Capabilities

#### 1.2.1 Knowledge Base Drawer

A right-side sliding drawer accessible from each pad containing:

| Component | Description |
|-----------|-------------|
| **Article List** | Filterable, searchable list of KB entries |
| **Category Tabs** | SOP, Patterns, Best Practices, Retros, Glossary |
| **Search Bar** | Full-text + semantic tag search |
| **Create Form** | Rich text editor with tag suggestions |
| **Version History** | Track changes with diff view |

#### 1.2.2 Citation Workflow

Allow stick authors to reference KB articles or prior threads:

\`\`\`
┌─────────────────────────────────────────────────┐
│  Citation Card (rendered in stick content)      │
├─────────────────────────────────────────────────┤
│  📄 API Rate Limit Playbook                     │
│  Category: SOP                                  │
│  "When hitting rate limits, implement..."       │
│                                                 │
│  [View Full Article] [Jump to Section]          │
└─────────────────────────────────────────────────┘
\`\`\`

#### 1.2.3 Semantic Similar Articles

When viewing a stick, automatically surface related KB content:

\`\`\`typescript
// Matching algorithm
interface SimilarityScore {
  tagOverlap: number;      // 0-1 weight: 0.4
  contentKeywords: number; // 0-1 weight: 0.3
  categoryMatch: number;   // 0-1 weight: 0.2
  recency: number;         // 0-1 weight: 0.1
}
\`\`\`

#### 1.2.4 Resolution Capture

When a stick is marked resolved, prompt the owner to:
1. Capture key learnings into KB
2. Auto-suggest tags based on discussion
3. Link to the resolution for future reference

### 1.3 Data Models

#### KB Article Schema

\`\`\`typescript
interface KBArticle {
  id: string;
  social_pad_id: string;
  org_id: string;
  author_id: string;
  
  // Content
  title: string;
  content: string;           // Rich text / Markdown
  category: KBCategory;
  tags: string[];
  
  // Metadata
  version: number;
  is_pinned: boolean;
  pin_order: number | null;
  
  // Metrics
  view_count: number;
  helpful_count: number;
  citation_count: number;
  
  // Timestamps
  created_at: string;
  updated_at: string;
  
  // Optional
  metadata: Record<string, unknown> | null;
}

type KBCategory = 
  | 'sop'           // Standard Operating Procedures
  | 'pattern'       // Design/Code Patterns
  | 'best_practice' // Best Practices
  | 'retro'         // Retrospective Notes
  | 'glossary'      // Term Definitions
  | 'playbook'      // Step-by-step Guides
  | 'decision'      // Decision Records
  | 'other';
\`\`\`

#### Citation Schema

\`\`\`typescript
interface StickCitation {
  id: string;
  stick_id: string;
  org_id: string;
  cited_by: string;
  
  // Citation target (one of these)
  kb_article_id: string | null;
  external_url: string | null;
  external_title: string | null;
  
  // Metadata
  citation_type: CitationType;
  note: string | null;
  
  created_at: string;
}

type CitationType = 
  | 'reference'     // General reference
  | 'resolution'    // Prior resolution
  | 'context'       // Background context
  | 'prerequisite'  // Required reading
  | 'related';      // Related content
\`\`\`

### 1.4 UI Components

#### Component Hierarchy

\`\`\`
KnowledgeBaseDrawer
├── KBSearchHeader
│   ├── SearchInput
│   └── CategoryFilter
├── KBArticleList
│   ├── KBArticleCard (×n)
│   │   ├── ArticleTitle
│   │   ├── CategoryBadge
│   │   ├── TagList
│   │   └── MetricsBadges (views, helpful, citations)
│   └── EmptyState
├── KBArticleDetail
│   ├── ArticleHeader
│   ├── RichContentViewer
│   ├── TagSection
│   ├── VersionHistory
│   └── ActionButtons (edit, cite, helpful)
└── KBArticleForm
    ├── TitleInput
    ├── CategorySelect
    ├── RichTextEditor
    ├── TagInput (with suggestions)
    └── SaveButton
\`\`\`

#### Drawer Positioning

\`\`\`css
.knowledge-base-drawer {
  position: fixed;
  right: 0;
  top: 0;
  height: 100vh;
  width: 400px;
  max-width: 90vw;
  z-index: 50;
  transform: translateX(100%);
  transition: transform 0.3s ease-in-out;
}

.knowledge-base-drawer.open {
  transform: translateX(0);
}
\`\`\`

### 1.5 API Endpoints

#### Knowledge Base CRUD

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/social-pads/[padId]/knowledge-base` | List KB articles |
| POST | `/api/social-pads/[padId]/knowledge-base` | Create KB article |
| GET | `/api/social-pads/[padId]/knowledge-base/[articleId]` | Get single article |
| PUT | `/api/social-pads/[padId]/knowledge-base/[articleId]` | Update article |
| DELETE | `/api/social-pads/[padId]/knowledge-base/[articleId]` | Delete article |

#### Search & Discovery

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/social-pads/[padId]/knowledge-base/search` | Semantic search |
| GET | `/api/social-sticks/[stickId]/related-kb` | Related articles for stick |

#### Citations

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/social-sticks/[stickId]/citations` | List stick citations |
| POST | `/api/social-sticks/[stickId]/citations` | Add citation |
| DELETE | `/api/social-sticks/[stickId]/citations/[citationId]` | Remove citation |

#### Engagement

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/social-pads/[padId]/knowledge-base/[articleId]/helpful` | Vote helpful |
| GET | `/api/social-pads/[padId]/knowledge-base/[articleId]/history` | Version history |

---

## Enhancement #2: AI-Assisted Summarization & Q&A

### 2.1 Feature Overview

Provide intelligent, auto-updating summaries of stick discussions with action item extraction and conversational Q&A.

### 2.2 Core Capabilities

#### 2.2.1 Live Thread Briefs

Auto-generated summaries that update when new replies arrive:

\`\`\`
┌─────────────────────────────────────────────────┐
│  AI Summary                    Updated 2m ago   │
├─────────────────────────────────────────────────┤
│  The team is discussing rate limit issues in    │
│  the payment API. Key decisions:                │
│  • Implement exponential backoff                │
│  • Add circuit breaker pattern                  │
│                                                 │
│  Current blockers:                              │
│  • Waiting on DevOps approval for config change │
├─────────────────────────────────────────────────┤
│  Action Items:                                  │
│  ☐ @sarah - Update retry logic by EOD          │
│  ☐ @mike - Review circuit breaker PR           │
│  ☑ @john - Document current limits             │
├─────────────────────────────────────────────────┤
│  Suggested Questions:                           │
│  • Have we validated the fix in staging?        │
│  • What's the rollback plan if this fails?      │
└─────────────────────────────────────────────────┘
\`\`\`

#### 2.2.2 Action Item Extraction

Parse task-language from replies and extract structured items:

\`\`\`typescript
interface ActionItem {
  id: string;
  description: string;
  owner: string | null;      // Extracted @mention
  owner_id: string | null;   // Resolved user ID
  due_hint: string | null;   // "EOD", "tomorrow", etc.
  status: 'pending' | 'completed';
  source_reply_id: string;
  extracted_at: string;
}
\`\`\`

#### 2.2.3 Question Generator

Analyze discussion gaps and suggest follow-up questions:

\`\`\`typescript
interface SuggestedQuestion {
  question: string;
  category: 'clarification' | 'validation' | 'next_step' | 'risk';
  confidence: number;  // 0-1
}
\`\`\`

#### 2.2.4 Pad Q&A Interface

Conversational interface to query across all sticks in a pad:

\`\`\`
┌─────────────────────────────────────────────────┐
│  Ask the Pad                                    │
├─────────────────────────────────────────────────┤
│  Q: What's blocking the mobile release?         │
│                                                 │
│  A: Based on discussions in 3 sticks:           │
│                                                 │
│  1. **API Migration** (2 days ago)              │
│     - Waiting on backend team to deploy v2      │
│                                                 │
│  2. **iOS Build Issues** (yesterday)            │
│     - Certificate expired, renewal in progress  │
│                                                 │
│  3. **QA Blockers** (4 hours ago)               │
│     - 2 P1 bugs remaining: #1234, #1235         │
│                                                 │
│  [View Stick] [View Stick] [View Stick]         │
├─────────────────────────────────────────────────┤
│  Was this helpful?  [👍] [👎]                   │
└─────────────────────────────────────────────────┘
\`\`\`

### 2.3 Data Models

#### AI Summary Fields (on social_sticks)

\`\`\`typescript
interface StickAIFields {
  // Live summary
  ai_live_summary: string | null;
  ai_summary_version: number;
  ai_summary_updated_at: string | null;
  ai_summary_metadata: {
    reply_count_at_generation: number;
    generation_time_ms: number;
    model_version: string;
    trigger_type: 'auto' | 'manual' | 'webhook';
  } | null;
  
  // Action items
  ai_action_items: ActionItem[] | null;
  
  // Suggested questions
  ai_next_questions: SuggestedQuestion[] | null;
}
\`\`\`

#### Q&A History

\`\`\`typescript
interface QAHistoryEntry {
  id: string;
  social_pad_id: string;
  org_id: string;
  asked_by: string;
  
  question: string;
  answer: string;
  citations: QACitation[];
  
  was_helpful: boolean | null;
  feedback_text: string | null;
  
  asked_at: string;
}

interface QACitation {
  stick_id: string;
  stick_topic: string;
  relevance_score: number;
  excerpt: string;
}
\`\`\`

### 2.4 AI Processing Pipeline

#### Summarization Flow

\`\`\`
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  New Reply  │────▶│  Debounce   │────▶│  Aggregate  │
│  Webhook    │     │  (5 sec)    │     │  Content    │
└─────────────┘     └─────────────┘     └─────────────┘
                                               │
                                               ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Update DB  │◀────│  Parse      │◀────│  Grok API   │
│  + Notify   │     │  Response   │     │  Call       │
└─────────────┘     └─────────────┘     └─────────────┘
\`\`\`

#### Grok Prompt Templates

**Summary Generation:**

\`\`\`typescript
const summaryPrompt = `
Analyze this discussion thread and provide:

1. A concise summary (2-3 sentences) of the current state
2. Key decisions made
3. Current blockers or open questions
4. Action items with owners (look for @mentions)
5. 2-3 suggested follow-up questions

Thread content:
Topic: ${stick.topic}
Content: ${stick.content}

Replies:
${replies.map(r => `[${r.user}]: ${r.content}`).join('\n')}

Respond in JSON format:
{
  "summary": "...",
  "decisions": ["..."],
  "blockers": ["..."],
  "action_items": [{"description": "...", "owner": "@user", "due_hint": "..."}],
  "suggested_questions": [{"question": "...", "category": "...", "confidence": 0.9}]
}
`;
\`\`\`

**Q&A Response:**

\`\`\`typescript
const qaPrompt = `
Answer this question based on the provided discussion threads.
Cite specific sticks when referencing information.

Question: ${question}

Available threads:
${sticks.map(s => `
---
Stick ID: ${s.id}
Topic: ${s.topic}
Content: ${s.content}
Replies: ${s.replies.length}
Summary: ${s.ai_live_summary || 'No summary'}
---
`).join('\n')}

Respond in JSON format:
{
  "answer": "...",
  "citations": [{"stick_id": "...", "excerpt": "...", "relevance_score": 0.9}],
  "confidence": 0.85
}
`;
\`\`\`

### 2.5 UI Components

#### Component Hierarchy

\`\`\`
StickSummaryCard
├── SummaryHeader
│   ├── AIBadge
│   ├── LastUpdated
│   └── RefreshButton
├── SummaryContent
│   ├── MainSummary
│   ├── DecisionsList
│   └── BlockersList
├── ActionItemsList
│   └── ActionItemRow (×n)
│       ├── Checkbox
│       ├── Description
│       ├── OwnerAvatar
│       └── DueHint
├── SuggestedQuestions
│   └── QuestionChip (×n)
└── SummaryFooter
    ├── EditButton (owner only)
    ├── FlagButton (report hallucination)
    └── VersionInfo

PadQADialog
├── QuestionInput
├── HistoryTabs
│   ├── AskTab
│   └── HistoryTab
├── AnswerDisplay
│   ├── AnswerContent
│   ├── CitationsList
│   │   └── CitationCard (×n)
│   └── FeedbackButtons
└── HistoryList
    └── QAHistoryCard (×n)
\`\`\`

### 2.6 API Endpoints

#### Summarization

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/social-sticks/[stickId]/summarize` | Generate/refresh summary |
| GET | `/api/social-sticks/[stickId]/summary` | Get current summary |
| PUT | `/api/social-sticks/[stickId]/summary` | Edit summary (owner) |
| GET | `/api/social-sticks/[stickId]/summary/history` | Summary versions |

#### Q&A

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/social-pads/[padId]/ask` | Ask question |
| GET | `/api/social-pads/[padId]/qa-history` | Q&A history |
| POST | `/api/social-pads/qa/[qaId]/feedback` | Submit feedback |

### 2.7 Real-time Updates

#### WebSocket Events

\`\`\`typescript
// Subscribe to summary updates
supabase
  .channel(`stick-summary:${stickId}`)
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'social_sticks',
    filter: `id=eq.${stickId}`,
  }, (payload) => {
    if (payload.new.ai_summary_version !== payload.old.ai_summary_version) {
      // Refresh summary UI
    }
  })
  .subscribe();
\`\`\`

#### Stale Detection

\`\`\`typescript
interface StaleDetection {
  // Summary is stale if:
  isStale: boolean;
  reason: 
    | 'new_replies'      // Replies added since last summary
    | 'time_elapsed'     // >24 hours old
    | 'content_changed'; // Stick content edited
  
  replyCountAtGeneration: number;
  currentReplyCount: number;
  lastSummaryAt: string;
}
\`\`\`

---

## Database Schema

### Complete ERD

\`\`\`
┌─────────────────────────┐
│     social_pads         │
├─────────────────────────┤
│ id (PK)                 │
│ name                    │
│ owner_id (FK)           │
│ org_id (FK)             │
└──────────┬──────────────┘
           │
           │ 1:N
           ▼
┌─────────────────────────┐      ┌─────────────────────────┐
│   social_sticks         │      │ social_pad_knowledge_   │
├─────────────────────────┤      │        base             │
│ id (PK)                 │      ├─────────────────────────┤
│ social_pad_id (FK)      │◀────▶│ id (PK)                 │
│ user_id (FK)            │      │ social_pad_id (FK)      │
│ topic                   │      │ author_id (FK)          │
│ content                 │      │ title                   │
│ ai_live_summary         │      │ content                 │
│ ai_action_items         │      │ category                │
│ ai_next_questions       │      │ tags[]                  │
│ ai_summary_version      │      │ version                 │
└──────────┬──────────────┘      │ view_count              │
           │                     │ helpful_count           │
           │ 1:N                 │ citation_count          │
           ▼                     └─────────────────────────┘
┌─────────────────────────┐               │
│  social_stick_replies   │               │
├─────────────────────────┤               │ 1:N
│ id (PK)                 │               ▼
│ social_stick_id (FK)    │      ┌─────────────────────────┐
│ user_id (FK)            │      │  social_kb_history      │
│ content                 │      ├─────────────────────────┤
└─────────────────────────┘      │ id (PK)                 │
           │                     │ kb_article_id (FK)      │
           │                     │ changed_by (FK)         │
           ▼                     │ version                 │
┌─────────────────────────┐      │ title                   │
│ social_stick_citations  │      │ content                 │
├─────────────────────────┤      │ change_summary          │
│ id (PK)                 │      └─────────────────────────┘
│ stick_id (FK)           │
│ kb_article_id (FK)      │◀─────┐
│ cited_by (FK)           │      │
│ citation_type           │      │
│ external_url            │      │
│ note                    │      │
└─────────────────────────┘      │
                                 │
┌─────────────────────────┐      │
│ social_kb_helpful_votes │      │
├─────────────────────────┤      │
│ id (PK)                 │      │
│ kb_article_id (FK)      │──────┘
│ user_id (FK)            │
│ is_helpful              │
└─────────────────────────┘

┌─────────────────────────┐
│ social_stick_ai_        │
│      changelog          │
├─────────────────────────┤
│ id (PK)                 │
│ stick_id (FK)           │
│ version                 │
│ summary                 │
│ action_items            │
│ next_questions          │
│ trigger_type            │
│ generated_at            │
└─────────────────────────┘

┌─────────────────────────┐
│ social_pad_qa_history   │
├─────────────────────────┤
│ id (PK)                 │
│ social_pad_id (FK)      │
│ asked_by (FK)           │
│ question                │
│ answer                  │
│ citations               │
│ was_helpful             │
│ feedback_text           │
│ asked_at                │
└─────────────────────────┘
\`\`\`

### Indexes

\`\`\`sql
-- Knowledge Base
CREATE INDEX idx_kb_pad_category ON social_pad_knowledge_base(social_pad_id, category);
CREATE INDEX idx_kb_tags ON social_pad_knowledge_base USING GIN(tags);
CREATE INDEX idx_kb_search ON social_pad_knowledge_base USING GIN(to_tsvector('english', title || ' ' || content));

-- Citations
CREATE INDEX idx_citations_stick ON social_stick_citations(stick_id);
CREATE INDEX idx_citations_kb ON social_stick_citations(kb_article_id);

-- AI Summaries
CREATE INDEX idx_sticks_summary_version ON social_sticks(ai_summary_version);
CREATE INDEX idx_sticks_summary_updated ON social_sticks(ai_summary_updated_at);

-- Q&A History
CREATE INDEX idx_qa_pad ON social_pad_qa_history(social_pad_id);
CREATE INDEX idx_qa_user ON social_pad_qa_history(asked_by);
\`\`\`

---

## API Endpoints

### Complete API Reference

#### Knowledge Base APIs

\`\`\`
GET    /api/social-pads/[padId]/knowledge-base
POST   /api/social-pads/[padId]/knowledge-base
GET    /api/social-pads/[padId]/knowledge-base/[articleId]
PUT    /api/social-pads/[padId]/knowledge-base/[articleId]
DELETE /api/social-pads/[padId]/knowledge-base/[articleId]
GET    /api/social-pads/[padId]/knowledge-base/search?q=...&category=...
POST   /api/social-pads/[padId]/knowledge-base/[articleId]/helpful
GET    /api/social-pads/[padId]/knowledge-base/[articleId]/history
\`\`\`

#### Citation APIs

\`\`\`
GET    /api/social-sticks/[stickId]/citations
POST   /api/social-sticks/[stickId]/citations
DELETE /api/social-sticks/[stickId]/citations/[citationId]
GET    /api/social-sticks/[stickId]/related-kb
\`\`\`

#### AI Summarization APIs

\`\`\`
POST   /api/social-sticks/[stickId]/summarize
GET    /api/social-sticks/[stickId]/summary
PUT    /api/social-sticks/[stickId]/summary
GET    /api/social-sticks/[stickId]/summary/history
\`\`\`

#### Q&A APIs

\`\`\`
POST   /api/social-pads/[padId]/ask
GET    /api/social-pads/[padId]/qa-history
POST   /api/social-pads/qa/[qaId]/feedback
\`\`\`

### Request/Response Examples

#### Create KB Article

**Request:**
\`\`\`http
POST /api/social-pads/abc123/knowledge-base
Content-Type: application/json
Authorization: Bearer <token>

{
  "title": "API Rate Limit Handling",
  "content": "## Overview\n\nWhen encountering rate limits...",
  "category": "sop",
  "tags": ["api", "rate-limit", "best-practices"]
}
\`\`\`

**Response:**
\`\`\`json
{
  "id": "kb_456",
  "social_pad_id": "abc123",
  "title": "API Rate Limit Handling",
  "content": "## Overview\n\nWhen encountering rate limits...",
  "category": "sop",
  "tags": ["api", "rate-limit", "best-practices"],
  "version": 1,
  "view_count": 0,
  "helpful_count": 0,
  "citation_count": 0,
  "created_at": "2025-01-06T10:00:00Z",
  "updated_at": "2025-01-06T10:00:00Z"
}
\`\`\`

#### Ask Pad Question

**Request:**
\`\`\`http
POST /api/social-pads/abc123/ask
Content-Type: application/json

{
  "question": "What's blocking the mobile release?"
}
\`\`\`

**Response:**
\`\`\`json
{
  "id": "qa_789",
  "question": "What's blocking the mobile release?",
  "answer": "Based on discussions in 3 sticks, the mobile release is blocked by...",
  "citations": [
    {
      "stick_id": "stick_001",
      "stick_topic": "API Migration",
      "relevance_score": 0.95,
      "excerpt": "Waiting on backend team to deploy v2 endpoint"
    },
    {
      "stick_id": "stick_002",
      "stick_topic": "iOS Build Issues",
      "relevance_score": 0.87,
      "excerpt": "Certificate expired, renewal in progress"
    }
  ],
  "asked_at": "2025-01-06T10:30:00Z"
}
\`\`\`

---

## Component Architecture

### File Structure

\`\`\`
components/social/
├── knowledge-base/
│   ├── knowledge-base-drawer.tsx       # Main KB drawer
│   ├── kb-article-card.tsx             # Article list item
│   ├── kb-article-detail.tsx           # Full article view
│   ├── kb-article-form.tsx             # Create/edit form
│   ├── kb-search-header.tsx            # Search + filters
│   ├── kb-version-history.tsx          # Version diff view
│   └── related-kb-articles.tsx         # Related suggestions
├── citations/
│   ├── add-citation-modal.tsx          # Citation picker
│   ├── citation-card.tsx               # Inline citation display
│   └── citation-list.tsx               # All citations for stick
├── ai-summary/
│   ├── stick-summary-card.tsx          # Summary display
│   ├── action-items-list.tsx           # Action item checklist
│   ├── suggested-questions.tsx         # Question chips
│   ├── summary-history.tsx             # Summary versions
│   └── summary-editor.tsx              # Owner editing
├── qa/
│   ├── pad-qa-dialog.tsx               # Q&A interface
│   ├── qa-answer-display.tsx           # Answer + citations
│   ├── qa-history-list.tsx             # Past questions
│   └── qa-feedback-buttons.tsx         # Helpful/not helpful
└── hooks/
    ├── use-knowledge-base.ts           # KB data fetching
    ├── use-citations.ts                # Citation management
    ├── use-stick-summary.ts            # Summary state
    └── use-pad-qa.ts                   # Q&A state
\`\`\`

### State Management

\`\`\`typescript
// Knowledge Base Context
interface KBContextValue {
  articles: KBArticle[];
  isLoading: boolean;
  error: Error | null;
  
  // Actions
  fetchArticles: (padId: string) => Promise<void>;
  createArticle: (data: CreateKBArticle) => Promise<KBArticle>;
  updateArticle: (id: string, data: UpdateKBArticle) => Promise<KBArticle>;
  deleteArticle: (id: string) => Promise<void>;
  searchArticles: (query: string, category?: string) => Promise<KBArticle[]>;
  voteHelpful: (articleId: string, isHelpful: boolean) => Promise<void>;
}

// AI Summary Hook
interface UseStickSummaryReturn {
  summary: StickSummary | null;
  isLoading: boolean;
  isStale: boolean;
  staleReason: string | null;
  
  // Actions
  regenerate: () => Promise<void>;
  edit: (summary: string) => Promise<void>;
  flagHallucination: (details: string) => Promise<void>;
}
\`\`\`

---

## Integration Points

### 1. Social Page Integration

\`\`\`typescript
// app/social/page.tsx

// Add KB button to pad header
<Button onClick={() => setKBDrawerOpen(padId)}>
  <BookOpen className="h-4 w-4" />
  Knowledge Base
</Button>

// Add Q&A button to pad header
<PadQADialog padId={pad.id} />
\`\`\`

### 2. Stick Detail Modal Integration

\`\`\`typescript
// components/social/stick-detail-modal.tsx

// Add summary card after content
<StickSummaryCard
  stickId={stick.id}
  summary={stick.ai_live_summary}
  actionItems={stick.ai_action_items}
  suggestedQuestions={stick.ai_next_questions}
  lastUpdated={stick.ai_summary_updated_at}
  replyCount={replies.length}
  onRegenerate={handleRegenerateSummary}
/>

// Add related KB articles
<RelatedKBArticles
  stickId={stick.id}
  padId={stick.social_pad_id}
  tags={stick.ai_generated_tags}
/>

// Add citations list
<CitationList
  stickId={stick.id}
  onAddCitation={() => setShowCitationModal(true)}
/>
\`\`\`

### 3. Grok Service Integration

\`\`\`typescript
// lib/ai/grok-service.ts

export class GrokService {
  // Add new methods
  async summarizeStick(stickId: string, content: string, replies: Reply[]): Promise<StickSummary>;
  async answerPadQuestion(padId: string, question: string, sticks: Stick[]): Promise<QAAnswer>;
  async suggestKBTags(content: string): Promise<string[]>;
}
\`\`\`

### 4. Real-time Integration

\`\`\`typescript
// hooks/use-realtime-sticks.ts

// Extend to watch for summary updates
useEffect(() => {
  const channel = supabase
    .channel(`stick-summaries:${padId}`)
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'social_sticks',
      filter: `social_pad_id=eq.${padId}`,
    }, handleSummaryUpdate)
    .subscribe();
    
  return () => { channel.unsubscribe(); };
}, [padId]);
\`\`\`

---

## Security Considerations

### Row Level Security Policies

\`\`\`sql
-- KB Articles: Pad members can read, authors can modify
CREATE POLICY kb_select_policy ON social_pad_knowledge_base
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM social_pad_members
    WHERE social_pad_id = social_pad_knowledge_base.social_pad_id
    AND user_id = auth.uid()
  )
);

CREATE POLICY kb_insert_policy ON social_pad_knowledge_base
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM social_pad_members
    WHERE social_pad_id = social_pad_knowledge_base.social_pad_id
    AND user_id = auth.uid()
    AND role IN ('owner', 'editor')
  )
);

-- Citations: Stick owner/editors can add
CREATE POLICY citations_insert_policy ON social_stick_citations
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM social_sticks ss
    WHERE ss.id = social_stick_citations.stick_id
    AND (
      ss.user_id = auth.uid() OR
      EXISTS (
        SELECT 1 FROM social_stick_members sm
        WHERE sm.social_stick_id = ss.id
        AND sm.user_id = auth.uid()
        AND sm.role IN ('owner', 'editor')
      )
    )
  )
);
\`\`\`

### Input Validation

\`\`\`typescript
// lib/validations/knowledge-base.ts
import { z } from 'zod';

export const createKBArticleSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(50000),
  category: z.enum(['sop', 'pattern', 'best_practice', 'retro', 'glossary', 'playbook', 'decision', 'other']),
  tags: z.array(z.string().max(50)).max(10),
});

export const createCitationSchema = z.object({
  kb_article_id: z.string().uuid().optional(),
  external_url: z.string().url().max(2000).optional(),
  external_title: z.string().max(200).optional(),
  citation_type: z.enum(['reference', 'resolution', 'context', 'prerequisite', 'related']),
  note: z.string().max(500).optional(),
}).refine(data => data.kb_article_id || data.external_url, {
  message: 'Either kb_article_id or external_url must be provided',
});
\`\`\`

### Rate Limiting

\`\`\`typescript
// Implement rate limits on AI endpoints
const AI_RATE_LIMITS = {
  summarize: { requests: 10, window: '1m' },
  ask: { requests: 20, window: '1m' },
  generateTags: { requests: 30, window: '1m' },
};
\`\`\`

---

## Performance Optimizations

### 1. Caching Strategy

\`\`\`typescript
// Cache KB articles per pad
const KB_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Cache AI summaries until invalidated
const SUMMARY_CACHE_KEY = (stickId: string) => `summary:${stickId}:v${version}`;
\`\`\`

### 2. Pagination

\`\`\`typescript
// KB article list pagination
const DEFAULT_PAGE_SIZE = 20;

interface PaginationParams {
  page: number;
  pageSize: number;
  sortBy: 'created_at' | 'updated_at' | 'helpful_count' | 'view_count';
  sortOrder: 'asc' | 'desc';
}
\`\`\`

### 3. Lazy Loading

\`\`\`typescript
// Load KB drawer content on demand
const KnowledgeBaseDrawer = dynamic(
  () => import('@/components/social/knowledge-base-drawer'),
  { loading: () => <DrawerSkeleton /> }
);
\`\`\`

### 4. Debouncing

\`\`\`typescript
// Debounce summary regeneration
const debouncedRegenerate = useDebouncedCallback(
  async (stickId: string) => {
    await regenerateSummary(stickId);
  },
  5000 // 5 second debounce
);
\`\`\`

---

## Implementation Phases

### Phase 1: Foundation (Week 1)

- [x] Database migrations executed
- [x] TypeScript types defined
- [x] API client libraries created
- [ ] RLS policies verified

### Phase 2: Knowledge Base UI (Week 2)

- [ ] Knowledge Base drawer component
- [ ] Article CRUD operations
- [ ] Search and filtering
- [ ] Version history view

### Phase 3: Citations (Week 3)

- [ ] Citation modal component
- [ ] Citation display in sticks
- [ ] Related articles suggestions
- [ ] Resolution capture workflow

### Phase 4: AI Summarization UI (Week 4)

- [ ] Summary card component
- [ ] Action items display
- [ ] Suggested questions
- [ ] Summary editing (owner)

### Phase 5: Q&A Interface (Week 5)

- [ ] Q&A dialog component
- [ ] Answer display with citations
- [ ] Q&A history
- [ ] Feedback system

### Phase 6: Real-time & Polish (Week 6)

- [ ] Real-time summary updates
- [ ] Stale detection
- [ ] Performance optimization
- [ ] Testing & bug fixes

---

## Testing Strategy

### Unit Tests

\`\`\`typescript
// __tests__/components/knowledge-base-drawer.test.tsx
describe('KnowledgeBaseDrawer', () => {
  it('should display articles filtered by category');
  it('should handle search queries');
  it('should allow creating new articles');
  it('should show version history');
});

// __tests__/components/stick-summary-card.test.tsx
describe('StickSummaryCard', () => {
  it('should display summary content');
  it('should show stale indicator when outdated');
  it('should allow regeneration');
  it('should display action items');
});
\`\`\`

### Integration Tests

\`\`\`typescript
// __tests__/api/knowledge-base.test.ts
describe('Knowledge Base API', () => {
  it('should create article with valid data');
  it('should reject unauthorized access');
  it('should update citation count on new citations');
  it('should maintain version history');
});
\`\`\`

### E2E Tests

\`\`\`typescript
// e2e/knowledge-base.spec.ts
test('user can create and cite KB article', async ({ page }) => {
  // Open KB drawer
  // Create new article
  // Navigate to stick
  // Add citation to article
  // Verify citation displays
});
\`\`\`

---

## Appendix

### A. Migration Checklist

- [ ] Run `scripts/create-social-collaboration-enhancements.sql`
- [ ] Verify all tables created
- [ ] Verify RLS policies active
- [ ] Verify indexes created
- [ ] Test with sample data

### B. Environment Variables

No new environment variables required. Uses existing:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `XAI_API_KEY` (for Grok)

### C. Dependencies

No new npm packages required. Uses existing:
- `@supabase/ssr`
- `ai` (Vercel AI SDK)
- `zod`
- `swr`

---

**End of Technical Specification**

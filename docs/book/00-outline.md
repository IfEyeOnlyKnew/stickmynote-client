# Stick My Note: Architecture from Source

## A technical deep dive into building a self-hosted enterprise collaboration platform

---

## Phase 2: Audience and Positioning

### Primary Audience

This book serves two readers simultaneously:

- **Technical leaders** (CTOs, engineering managers, architects) evaluating whether to build or buy enterprise collaboration tools. They want architecture rationale, trade-off analysis, and deployment topology. They can skip code blocks and deep-dive sections.

- **Senior engineers** building self-hosted SaaS products, especially those working with Next.js, PostgreSQL, and on-premise infrastructure. They want implementation patterns they can steal: multi-tenant auth, real-time WebSocket architecture, self-hosted AI integration, and production deployment on Windows Server.

### Core Thesis

**Stick My Note makes the architectural bet of *self-hosted sovereignty*: every component — AI inference, video conferencing, authentication, file storage — runs on your own network, and every design decision in the codebase serves that bet.**

This manifests everywhere:
- Ollama for AI instead of OpenAI APIs (data never leaves your network)
- LiveKit self-hosted for video instead of Twilio/Daily.co (media stays on-premise)
- LDAP/Active Directory for auth instead of Auth0 (identity stays internal)
- PostgreSQL LISTEN/NOTIFY instead of Redis Pub/Sub (fewer external dependencies)
- Memcached called "redis" (pragmatic naming over purity)
- Custom `server.js` instead of Next.js defaults (control over WebSocket, TLS, file serving)

### What Makes It Worth a Book

The source code has no narrative. You can read 1,458 files and still not understand:
- Why notes and sticks are separate systems with different permission models
- Why the WebSocket server must set `app.didWebSocketSetup = true` (a Node.js v24 bug)
- Why rate limiting fails open instead of closed
- Why "inference" means collaborative knowledge discovery, not just AI
- How four independent caching layers coordinate (or don't)
- Why the auth system has no refresh tokens

The book provides: narrative arc, cross-cutting pattern analysis, design rationale, and transferable lessons.

---

## Phase 3: Book Structure

### Part I — Foundations
*"Before you can build anything, you need to know where you're standing."*

**Chapter 1: The Architecture of Sovereignty** (~400 lines)
- The self-hosted thesis and why it drives every decision
- Network topology: 6 servers, each with a single responsibility
- Technology stack: Next.js App Router, PostgreSQL, Memcached, LiveKit, Ollama
- The custom `server.js` and why Next.js defaults aren't enough

**Chapter 2: The Database Layer** (~500 lines)
- Dual access patterns: raw `pg-client` vs. Supabase-compatible query builder
- Connection pooling (20 connections, 10s timeout, 30s idle)
- The database adapter that mimics PostgREST without PostgREST
- Transaction support and materialized view refresh
- Why individual env vars instead of a connection string

**Chapter 3: Caching in Four Layers** (~500 lines)
- Layer 1: In-memory LRU (1000 items, 5-minute TTL)
- Layer 2: Memcached with Redis-compatible API (the naming story)
- Layer 3: Next.js `unstable_cache` with tag-based invalidation
- Layer 4: Upstash Redis REST for API response caching
- How they coordinate (spoiler: they mostly don't)
- The fail-open philosophy: caching failures never break requests

### Part II — Identity and Tenancy
*"Who you are determines what you see."*

**Chapter 4: Authentication — Three Roads to the Same Session** (~600 lines)
- LDAP/Active Directory: bind, search, validate, provision
- OIDC/SSO: PKCE flow, discovery caching, federated identity linking
- Local auth: bcrypt, JWT (7-day, no refresh), session cookies
- The `resolveAuthMethod()` decision tree: email domain routing
- Why there are no refresh tokens (simplicity vs. security trade-off)

**Chapter 5: Defense in Depth** (~500 lines)
- CSRF: stateless HMAC-signed tokens (no server state needed)
- Rate limiting: PostgreSQL primary, Redis optional, memory fallback — and why it fails open
- Account lockout: per-org configurable thresholds
- Two-factor authentication: TOTP + encrypted backup codes
- AES-256-GCM encryption with org-specific key derivation
- DLP: content scanning for PII patterns
- The fire-and-forget audit trail (and its blind spots)

**Chapter 6: Organizations and Multi-Tenancy** (~500 lines)
- Organization model: personal vs. team vs. enterprise
- Role hierarchy: viewer(0) → member(1) → admin(2) → owner(3)
- The `getOrgContext()` pattern: every request scoped to an org
- Invitation system: three types (org, pad, global) with auto-processing on login
- DN pattern matching: LDAP distinguished names as org selectors
- Settings as JSONB: flexible configuration without migrations

### Part III — The Domain Model
*"A note is not a stick is not a pad — and the distinction matters."*

**Chapter 7: Notes, Sticks, and Pads** (~600 lines)
- Three data entities that look similar but serve different purposes
- `personal_sticks`: private, binary sharing, reply-based
- `paks_pad_sticks`: collaborative, role-based access, tab-based
- `paks_pads`: workspaces containing sticks with member management
- Why they weren't unified (and the cost of that decision)
- Cross-org collaboration: sticks inherit the pad's org_id, not the user's

**Chapter 8: The Tab System and Rich Content** (~400 lines)
- Multi-content architecture: details, images, videos, tags, links
- Lazy tab creation: defaults generated on first access
- TipTap rich text editor: extensions, callout blocks, collapsible sections
- The dual title/topic field legacy
- CalSticks: replies repurposed as calendar tasks (concept overloading)

**Chapter 9: Templates and Quick Creation** (~300 lines)
- Pad templates: starter configurations with category organization
- Stick templates: pre-built content patterns with usage tracking
- QuickSticks: lightweight creation with minimal UI
- The CRUD pipeline: auth → org context → permission check → query → transform → cache

### Part IV — Real-Time Collaboration
*"The hardest part of collaboration isn't the feature — it's the connection."*

**Chapter 10: The WebSocket Server** (~600 lines)
- Why `server.js` sets `app.didWebSocketSetup = true` (the Node.js v24 story)
- Post-upgrade authentication: handshake first, auth second
- Connection management: 5-socket limit per user, 30s heartbeat, FIFO eviction
- PostgreSQL LISTEN/NOTIFY as cross-process message bus
- The 7,900-byte payload limit and what happens when you exceed it
- Client-side singleton: one WebSocket shared across all React components
- Wildcard event subscriptions and exponential backoff reconnection

**Chapter 11: Chat, Presence, and Notifications** (~500 lines)
- Three chat systems: thread messages, chat requests (invitation workflow), stick chats
- Chat request state machine: pending → accepted/busy/schedule_meeting/give_me_5_minutes
- Dual-mode reliability: WebSocket primary, polling fallback (5s/30s intervals)
- Presence heartbeats: 30-second POST to `/api/user/presence`
- Notification bell: combined notifications + chat requests with focus mode
- The escalation heuristic: caps ratio and exclamation marks detect frustration

**Chapter 12: Video with LiveKit** (~400 lines)
- Self-hosted LiveKit SFU on dedicated server (media stays on-network)
- Caddy reverse proxy for TLS termination (LiveKit lacks native TLS)
- Token generation: 6-hour TTL, room join + publish + subscribe grants
- WebSocket proxy: raw TCP pipe from `/livekit-ws/*` to internal LiveKit
- Room management: 5-minute empty timeout, 10 participant max
- Custom UI: speaker detection, screen share, emoji reactions via data channel

### Part V — Intelligence
*"AI that never phones home."*

**Chapter 13: The Ollama-First AI Architecture** (~500 lines)
- Provider hierarchy: Ollama → Azure OpenAI → Anthropic Claude
- Direct API before SDK: why `fetch('/api/generate')` is tried before the AI SDK
- The 12-method AIService: tags, summaries, duplicates, sentiment, action items
- Structured prompt responses with delimiter-based parsing
- Escalation detection in chat: keyword lists + caps ratio + exclamation count
- Per-org session limits and rate limiting for expensive operations
- The `GrokService` alias: naming archaeology

**Chapter 14: The Inference Hub — Collaborative Knowledge** (~500 lines)
- "Inference" as a business concept: collaborative knowledge discovery, not just AI
- Social pads vs. personal sticks: a parallel universe of collaborative data
- Workflow state machine: idea → triage → in_progress → resolved
- Knowledge base: articles with search, categories, and helpfulness voting
- Cleanup policies with exemptions: pinned and workflow-active items survive
- 80+ API endpoints serving the inference subsystem
- Activity feed with 90-day retention window

### Part VI — Discovery and Observability
*"You can't manage what you can't find or measure."*

**Chapter 15: Search Across Everything** (~500 lines)
- Dual-mode search: PostgreSQL full-text search + ILIKE fuzzy fallback
- Panel search pipeline: cache check → query → parallel enrichment → tag filter
- The view count that doesn't exist (mock data with `Math.random()`)
- Search analytics: query tracking, click-through recording, trending analysis
- Saved searches and auto-complete suggestions
- V1 vs. V2 APIs: two generations coexisting

**Chapter 16: Analytics, Audit, and Health** (~500 lines)
- User analytics: streaks, activity patterns, temporal metrics
- The audit trail: 50+ event types, fire-and-forget logging, org-scoped queries
- UUID validation: non-UUID resource IDs stored in metadata JSONB
- Health monitoring: database, auth, Redis, external APIs with degraded/unhealthy states
- Web Vitals tracking: LCP, FID, CLS in a circular buffer
- Cron jobs: cleanup policies, digest emails, expired chat removal

### Part VII — The Frontend
*"1,458 files rendered through 57 primitives."*

**Chapter 17: Component Architecture and State** (~600 lines)
- Three-tier components: shadcn/ui primitives → composites → feature containers
- No Redux, no Zustand: Context API + custom hooks (and why that's enough)
- Organization context: 19 properties, custom events, cookie persistence
- NoteContext: 40+ event handlers flowing down the component tree
- Toast without Context: module-level closure state callable from anywhere
- Theme system: CSS variables for system theme + org branding overlay
- Dynamic favicon replacement for white-label multi-tenancy

**Chapter 18: Responsive Design, PWA, and Accessibility** (~500 lines)
- Adaptive breakpoints: mobile (768px) → tablet (1024px) → desktop
- Custom virtualization: IntersectionObserver, not react-virtual
- Grid layout hook: column calculation from viewport width
- PWA stack: service worker registration, install prompt, offline indicator
- Accessibility context: 6 preferences (font size, contrast, motion, focus, links, line height)
- KeyboardDetector: the invisible component that returns null
- Pull-to-refresh with resistance formula: `distance * 0.5`
- Safe area handling for notched devices

### Epilogue: Patterns Worth Stealing (~300 lines)
- The sovereignty pattern: self-hosting as architectural principle
- Fail-open vs. fail-closed: when availability beats security
- The Supabase-compatible adapter: migrating without migrating
- Four-layer caching without coordination
- Direct function calls over internal fetch (the Node.js v24 lesson)
- Polling as WebSocket fallback (two-tier reliability)
- Fire-and-forget for non-critical paths
- Organization-scoped everything: the multi-tenant key

---

## Book Metrics (Estimated)

| Metric | Target |
|--------|--------|
| Parts | 7 + Epilogue |
| Chapters | 18 + Epilogue |
| Lines per chapter | 300-600 |
| Total estimated lines | ~9,000 |
| Mermaid diagrams | 30-40 |
| Code blocks (pseudocode) | 50-70 |
| "Apply This" patterns | 90 (5 per chapter) |

---

## Review Checklist

- [ ] Does the chapter ordering build knowledge progressively?
- [ ] Can a technical leader skip deep dives and still follow the narrative?
- [ ] Does every chapter connect back to the sovereignty thesis?
- [ ] Are there any subsystems missing from the outline?
- [ ] Is the chapter sizing reasonable (300-600 lines each)?

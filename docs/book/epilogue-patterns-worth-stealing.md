# Epilogue: Patterns Worth Stealing

You have now read the source code of a self-hosted collaboration platform from database schema to PWA manifest. You have seen how authentication flows through LDAP, OIDC, and local credentials. You have traced a note from creation through WebSocket broadcast to every connected client. You have watched an AI inference request travel from browser to Ollama and back without touching a public cloud. Along the way, you encountered decisions that were sometimes elegant, sometimes expedient, and occasionally both.

This epilogue is not a summary. The chapters already said what they said. Instead, this is an extraction — eight patterns that recur across every layer of the system, patterns that are not specific to collaboration tools or to Next.js or to PostgreSQL. They are patterns about building software you intend to operate yourself, on infrastructure you control, for users you are accountable to. If you are building something similar, steal them. If you are building something different, at least consider them before you choose otherwise.


## 1. The Sovereignty Pattern

Every technology decision in this codebase follows from a single premise: data does not leave the network. Ollama instead of OpenAI. LiveKit instead of Twilio. LDAP and local credentials instead of Auth0. PostgreSQL LISTEN/NOTIFY instead of a managed pub/sub service. Memcached on a dedicated host instead of a cloud caching tier. This is not an ideological position. It is an architectural constraint, and like all good constraints, it simplifies some decisions while complicating others.

The simplification is compliance. When a customer asks where their data lives, the answer is a rack in a room with a lock on the door. There is no third-party data processing agreement to audit, no sub-processor list to review, no region selector to configure. The data is here. Full stop. For organizations in regulated industries — healthcare, defense, legal, finance — this answer eliminates entire categories of procurement friction. It does not eliminate all friction, but it eliminates the kind that delays projects by quarters.

The complication is operations. When Ollama goes down, there is no status page to check and no support ticket to file. When LiveKit needs a TLS certificate renewed, there is no managed service handling it. When the PostgreSQL server runs out of disk space at two in the morning, the person who gets paged is the same person who chose to self-host. This is the trade-off, and it is not a small one. Managed services exist because operations are genuinely hard, and outsourcing operations to specialists is often the rational economic choice.

The sovereignty pattern is worth adopting when the cost of data leaving your network — regulatory, reputational, or simply philosophical — exceeds the cost of operating the infrastructure yourself. It is worth avoiding when your team does not have the operational maturity to keep services running, or when the data you handle carries no particular sensitivity. The litmus test is simple: if your organization would accept the same data living in a SaaS provider's multi-tenant database, you do not need sovereignty. If it would not, you do.


## 2. Fail-Open vs. Fail-Closed

The rate limiter in this system catches its own exceptions and returns "allow" when something goes wrong. If Memcached is unreachable, requests are not throttled. If the token bucket calculation throws, the request proceeds. This is fail-open behavior, and it appears in at least four places: rate limiting, cache reads, audit trail writes, and presence heartbeats. In each case, the system chose availability over restriction.

This is not the universally correct choice. It is the correct choice for a collaboration tool where the most likely user of the system is also its administrator. If rate limiting fails closed and PostgreSQL hiccups during a connection pool rotation, every user in the organization is locked out of their own workspace. They cannot access their notes. They cannot check their chat messages. They cannot even load the page that would tell them what went wrong. For a tool whose primary value proposition is keeping teams productive, a five-minute lockout because a cache server restarted is worse than a five-minute window where rate limits are not enforced.

For a banking application, the calculus inverts completely. A five-minute window without rate limiting on a login endpoint is an invitation for credential stuffing. A five-minute lockout is an inconvenience. The domain determines the default. Collaboration tools optimize for availability. Financial systems optimize for restriction. Healthcare systems optimize for auditability. Each domain has a failure mode that is more acceptable than the others, and the architecture should reflect that hierarchy.

The pattern extends beyond rate limiting. Cache misses should fall through to the database, not return errors. Audit trail writes should not block the operation they are recording. Presence updates should degrade gracefully when the real-time connection drops. In each case, ask: if this subsystem fails, should the user's primary task still complete? If the answer is yes, the subsystem should fail open. If the subsystem is the primary task — authentication, authorization, data persistence — it must fail closed.

The litmus test: imagine explaining the failure mode to the person whose workday depends on your software. "Your note didn't save because the audit logger was down" is indefensible. "The audit log has a three-minute gap because Memcached restarted" is a conversation you can have.


## 3. The Adapter as Escape Hatch

The database adapter in this codebase speaks a particular API — `.from('table').select('columns').eq('field', value)` — but underneath, it generates raw PostgreSQL queries and executes them through a connection pool. The API is familiar to anyone who has used Supabase. The implementation has no dependency on Supabase whatsoever.

This was a deliberate architectural choice. The team could adopt Supabase later by replacing one module. They could stay on raw PostgreSQL forever and lose nothing. The adapter is not a premature abstraction — it is an escape hatch. It decouples the application's data access patterns from the specific database client, without introducing a full ORM with its own opinions about migrations, relationships, and query optimization.

The broader pattern is about framework boundaries. Every external dependency — database clients, authentication providers, AI inference endpoints, video services — should have a seam where you can swap the implementation without rewriting the consumers. This does not mean building elaborate abstraction layers on day one. It means identifying the boundaries where lock-in would be most painful and ensuring those boundaries are explicit in the code. A function that takes a query and returns rows is a boundary. An ORM that requires decorators on every model class is a cage.

The anti-pattern is equally clear: wrapping everything in adapters "just in case" produces layers that serve no purpose except making stack traces longer. The adapter is justified when the dependency is likely to change, when the dependency's API is complex enough that consumers should not use it directly, or when testing requires a seam. If you are using SQLite for development and PostgreSQL for production, an adapter is mandatory. If you are using PostgreSQL everywhere and have no plans to change, a thin query helper is sufficient.

The litmus test: can you explain, in one sentence, what the adapter protects you from? If the answer is "changing our database provider" or "testing without a live database," the adapter earns its keep. If the answer is "I don't know, it just seemed like good practice," delete it.


## 4. Independent Caching Layers

The system runs four caching layers: an in-memory Map for hot data like auth lookups, Memcached for shared state across potential future instances, the Next.js built-in cache for rendered pages and fetched data, and Upstash Redis for rate limiting counters. None of these layers knows about the others. There is no unified cache invalidation protocol. There is no coordination bus. Each layer has its own TTL, and when data changes, each layer discovers the change independently when its TTL expires.

This sounds like a design flaw. In a distributed systems textbook, it probably is. Cache coherence is a well-studied problem with well-known solutions: invalidation messages, versioned keys, write-through caches, event-driven purges. These solutions work. They also require infrastructure to operate, monitoring to observe, and debugging expertise when they misbehave. For a team of one to five people running a self-hosted application, the operational cost of a unified cache invalidation system exceeds the cost of occasionally serving stale data for a few minutes.

The key insight is that TTL-based expiry converts a distributed systems problem into a configuration problem. Instead of asking "how do I ensure every cache layer reflects this write immediately," you ask "how stale can this data be before users notice?" Auth data can be five minutes stale — a deactivated user retains access briefly. Presence data can be thirty seconds stale — an offline user shows as online briefly. Note content should not be cached at all in the collaboration context — users expect to see edits immediately. Each layer's TTL is a product decision, not a systems decision.

The failure mode is predictable: a user updates their profile photo and it takes a few minutes to appear everywhere. This is a known, bounded, explainable inconsistency. Compare this to the failure mode of a cache invalidation system: a message is dropped, one cache layer has stale data while others do not, and the user sees different profile photos depending on which page they load. The second failure mode is intermittent, difficult to reproduce, and demoralizing to debug.

Apply this pattern when your team is small, your consistency requirements are measured in minutes rather than milliseconds, and your operational capacity for debugging distributed cache coherence is limited. Avoid it when strong consistency is a business requirement — when showing a stale price, a stale balance, or a stale permission would cause real harm. The litmus test: if a user sees data that is three minutes old, do they file a bug report or do they not even notice?


## 5. Direct Calls Over Network Indirection

A specific bug taught a general lesson. In production, running Node.js v24 with a custom HTTPS server, API routes that called other API routes via `fetch()` failed. The server's TLS certificate, perfectly valid for external clients, was not trusted by the server's own HTTP client when calling localhost. The fix was simple: replace the internal `fetch()` with a direct function import. Instead of `POST /api/auth/check-lockout`, call `checkLockout(email)` directly.

The lesson extends well beyond TLS quirks. Every network hop — even to localhost — introduces failure modes that a function call does not have. DNS resolution, TCP handshake, TLS negotiation, HTTP parsing, request serialization, response deserialization, timeout handling, retry logic. A direct function call has exactly one failure mode: the function throws. A localhost HTTP call has at least eight. In a monolithic application where the caller and callee share a process, the network call is pure overhead and pure risk.

The counterargument is decoupling. If the lockout check is an HTTP endpoint, it can be extracted into a microservice later. This is true, and it is also speculative architecture — building for a future that may never arrive, at the cost of reliability today. The self-hosted context makes the argument even weaker: if you are running the entire application on a single server, the microservice extraction is unlikely. And if it does happen, replacing a function import with an HTTP call is a thirty-minute task. Replacing a broken HTTP call with a function import in production at midnight is a worse thirty minutes.

This pattern applies whenever you find code calling itself over the network. API routes calling other API routes. Services posting to their own webhook endpoints. Server components fetching from the same server's API. In each case, ask: is there a reason this needs to cross a network boundary? If the answer involves the word "eventually," consider doing it directly now and refactoring later. The litmus test: trace the call. If the request leaves the process and returns to the same process, you have found unnecessary indirection.


## 6. Polling as the Reliability Floor

The WebSocket server delivers chat messages in single-digit milliseconds on a local network. When it works, the experience is indistinguishable from a native desktop application. When it does not work — when a proxy drops the connection, when the server restarts, when the client's network briefly interrupts — there needs to be a floor beneath the real-time layer.

That floor is polling. Chat messages poll at three-second intervals when the WebSocket is disconnected. Presence information polls at thirty seconds. Calendar events poll at thirty seconds. The polling intervals are chosen per feature based on how stale the data can be before the user's experience degrades meaningfully. Chat is latency-sensitive, so three seconds. Presence is latency-tolerant, so thirty. The intervals are not optimized — they are acceptable.

The critical implementation detail is mutual exclusion. The WebSocket connection and the polling fallback never run simultaneously. A boolean tracks whether the WebSocket is connected. When it connects, the polling interval is cleared. When it disconnects, polling restarts. This prevents duplicate event processing, unnecessary server load, and the subtle bugs that emerge when two independent data paths deliver the same event at slightly different times.

The pattern generalizes to any feature built on an unreliable transport. If your application uses server-sent events, WebSocket, or gRPC streaming, the question is not whether the connection will drop but when. Features that only work during a healthy real-time connection are features that will break in production. The dual-mode approach — real-time for speed, polling for reliability — ensures that every feature has a degraded-but-functional fallback. Users who experience the degraded mode may never know they are missing the real-time layer. Users who experience a broken feature will definitely know.

The litmus test: disconnect your WebSocket server and use the application for ten minutes. If features are slower but functional, you have built the floor. If features are broken, you have built a dependency.


## 7. Fire-and-Forget for Side Effects

When a user creates a note, the system does several things: it inserts a row into the database, it broadcasts a WebSocket event, it writes an audit trail entry, and it updates search analytics. Of these, exactly one must succeed for the operation to be considered complete: the database insert. The rest are side effects, and they are all wrapped in try-catch blocks that log errors and swallow them.

This pattern appears throughout the codebase. Audit trail writes catch and discard errors. Presence heartbeats fail silently. Search analytics updates are best-effort. WebSocket broadcasts catch dead-socket errors and clean up without interrupting the caller. In each case, the primary operation — the thing the user asked for — completes regardless of whether the side effects succeed.

The risk is real and should not be minimized. Fire-and-forget means silent data loss. If the audit trail write fails and the error is swallowed, there is a gap in the audit log that no one may notice until an audit review weeks later. If search analytics silently drop events, search relevance degrades without any visible indicator. The pattern trades completeness for availability, and that trade has a cost.

The mitigation is layered. The database itself provides durability guarantees for the primary operation. Audit logs can be reconstructed from database state if gaps are detected. Search indexes can be rebuilt from source data. The side effects are not the system of record — they are derived data, optimization hints, or operational telemetry. Losing them is regrettable but recoverable. Losing the primary operation is not.

Apply this pattern to operations that meet two criteria: the data can be reconstructed from other sources, and the operation's failure should not be visible to the user. Audit logs, analytics, cache warming, notification delivery — these are candidates. Database writes, payment processing, file persistence — these are not. The litmus test: if this side effect silently failed for an hour, would you discover it from user reports or from your monitoring? If the answer is monitoring, fire-and-forget is appropriate. If the answer is user reports, it is not.


## 8. Organization-Scoped Everything

Every SQL query in the multi-tenant portions of this system includes an `org_id` filter. Every file upload path includes the organization identifier. Every AI inference session is metered against an organization's quota. Every settings object is stored as per-organization JSONB. This is not defense in depth — it is the single most important security boundary in the application, and its effectiveness depends entirely on the word "every."

The discipline is monotonous by design. There is no clever framework that automatically injects the organization filter. There is no middleware that magically scopes every query. The `org_id` appears in the WHERE clause because a developer put it there, and it appears in every WHERE clause because code review caught the ones where it was missing. Automated solutions exist — row-level security in PostgreSQL, tenant-aware ORMs, request-scoped database connections — but they introduce complexity that must itself be verified. The explicit filter is verbose, but it is also visible. A code reviewer can see whether it is present or absent. An automated scope injection must be trusted to work correctly in every context, including contexts the framework author did not anticipate.

The failure mode of a missing organization filter is a data leak. Not a theoretical data leak in a security researcher's report, but an actual data leak where User A sees User B's notes because a new API endpoint forgot to include the filter. In a self-hosted single-organization deployment, this is embarrassing. In a multi-organization deployment, it is a breach. The severity scales with the deployment model, but the fix is the same: the filter must be present in every query, and the absence of the filter must be treated as a bug with the same priority as data loss.

The pattern extends beyond database queries. File system paths should include the organization to prevent path traversal across tenants. API rate limits should be per-organization to prevent one organization's usage from degrading another's experience. Feature flags and settings should be per-organization to allow independent configuration. The organization boundary should be as pervasive in your code as the user boundary, and in many cases more pervasive — users move between organizations, but data should not.

The litmus test is a grep. Search your codebase for queries that touch tenant-scoped tables without including the organization filter. If you find any, you have found a data leak. If you find none, do the search again after your next feature ships.


## Closing

This codebase is not a reference architecture. It is a working system with working compromises. Some decisions — fail-open rate limiting, independent caching layers, fire-and-forget side effects — would not survive a review at a company where five nines of availability is a contractual obligation. They survive here because they serve the actual operating environment: a small team, a local network, a finite number of users whose names are known to the administrator.

The difference between self-hosted software and on-premise software is attitude. On-premise implies that someone else built it and you are merely running it in your own data center, inheriting their architectural opinions along with their deployment artifacts. Self-hosted implies that you chose every component, understood every trade-off, and accepted responsibility for every operational consequence. The PostgreSQL server does not page a vendor's support team. The LiveKit instance does not fall back to a cloud provider. The Ollama models do not phone home. Every piece of the system is here because someone decided it should be here, and that same someone will be the one who fixes it when it breaks.

This is not for everyone. It should not be for everyone. The managed service ecosystem exists because most teams should not be running their own video infrastructure, their own AI inference servers, their own authentication systems. The operational burden is real, the expertise required is broad, and the failure modes are yours alone to diagnose. But for the teams and organizations where data sovereignty is not negotiable — where the answer to "where does the data live" must be a physical address and not a region selector — self-hosting is not a limitation. It is the architecture.

Build accordingly. And when something breaks at two in the morning, remember: you chose this. Own it.

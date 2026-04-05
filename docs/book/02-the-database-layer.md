# Chapter 2: The Database Layer

In Chapter 1 we mapped six servers across a private network, each with a single job. The database server's job is the most consequential: it holds every note, every user, every organization, every audit record. It runs PostgreSQL on a dedicated Windows Server machine, isolated from the application server by a network hop. That isolation is the point. The application can be rebuilt in an afternoon. The data cannot.

Most web frameworks treat the database as an implementation detail -- something you configure once in a `.env` file and forget about. For a self-hosted platform, the database is the system. It is the reason the other five servers exist. The application server renders pages and handles API requests, but every meaningful state change -- creating a note, joining an organization, sending a message -- becomes real only when it is committed to PostgreSQL. The database layer is the code that makes those commits happen reliably, efficiently, and without leaking complexity into the rest of the application.

But a database is only as useful as the code that talks to it. Stick My Note uses *two* distinct access patterns to reach the same PostgreSQL instance, and understanding why reveals a deeper architectural choice: the system was designed to feel like a managed platform while remaining entirely self-hosted. One layer speaks raw SQL for performance-critical paths. The other speaks a chainable query builder that looks suspiciously like Supabase's client library -- because the team wanted Supabase's developer experience without Supabase's bill or Supabase's network egress.

This chapter covers both layers, the connection pool that underlies them, and the trade-offs baked into the places where they deliberately chose simplicity over strict consistency.

The architecture here solves a specific problem: how do you give a team of developers the ergonomics of a managed database service (Supabase, Firebase, PlanetScale) while keeping the database on a server you own, on a network you control, with credentials you manage? The answer is two complementary abstractions over a shared connection pool -- one for power, one for convenience -- and a set of conventions that keep them from stepping on each other.

What follows is not a tutorial on PostgreSQL or connection pooling. It is a study of the specific decisions that shaped a production database layer for a self-hosted platform: what was built, what was deliberately left out, and why the seams between the two access patterns exist where they do.

---

## The Connection Pool

Every request to the application server may need the database. If each request opened and closed a TCP connection to PostgreSQL, the overhead would dominate response time -- especially across a network hop from one server to another. Connection pooling solves this: a fixed set of long-lived connections shared across all incoming requests.

The pool is a singleton. The entire application process gets one `Pool` instance, created lazily on first use, reused for every subsequent query. This is a deliberate choice: Next.js in production runs a single Node.js process (managed by the custom `server.js` from Chapter 1), so a singleton pool maps one-to-one with the process lifecycle. The singleton is exported as a module-level constant: `export const db = new PostgresDatabase()`. Any module that imports `db` gets the same instance, the same pool, and the same connections.

Why lazy initialization instead of creating the pool at import time? Because Next.js imports modules during the build step. If the pool were created in the constructor, the build process would attempt to connect to PostgreSQL -- which may not be reachable from the build environment, or may not even exist yet. Lazy initialization via `getPool()` means the pool is created only when the first query is executed at runtime, safely after the application has started.

```typescript
// Pseudocode: Singleton pool with lazy initialization
class PostgresDatabase {
  private pool = null
  private config = {
    host: env.POSTGRES_HOST,     // 192.168.50.30
    port: env.POSTGRES_PORT,     // 5432
    max: env.POSTGRES_MAX_POOL,  // 20
    idleTimeoutMillis: 30000,    // Release idle connections after 30s
    connectionTimeoutMillis: 10000,  // Fail fast if pool is exhausted
  }

  getPool() {
    if (!this.pool) {
      this.pool = new Pool(this.config)
      this.pool.on('error', logUnexpectedError)
    }
    return this.pool
  }
}
```

The numbers matter. Twenty connections is the default maximum. That ceiling means twenty concurrent SQL statements in flight at any moment -- enough for a team collaboration tool, not enough for a high-traffic consumer product. The 10-second connection timeout means that if all twenty connections are checked out and a twenty-first request arrives, it will wait up to 10 seconds before throwing an error. This is a fail-fast philosophy: better to return an error quickly than queue indefinitely.

The 30-second idle timeout is the other side of the coin. Connections that sit unused for half a minute are closed, freeing resources on the PostgreSQL side. Under light load the pool shrinks; under heavy load it grows back up to twenty. This breathing pattern keeps the database server from holding open connections that nobody is using.

```mermaid
graph LR
    subgraph "Application Server"
        R1[Request 1] --> P[Connection Pool<br/>max: 20]
        R2[Request 2] --> P
        R3[Request N] --> P
    end
    subgraph "Database Server"
        P -->|Connection 1| PG[(PostgreSQL)]
        P -->|Connection 2| PG
        P -.->|up to 20| PG
    end
    style P fill:#334155,stroke:#60a5fa,color:#e2e8f0
    style PG fill:#1e3a2f,stroke:#4ade80,color:#e2e8f0
```

### Pool Events and Error Handling

The pool registers two event handlers at creation time. The `error` handler catches unexpected disconnections -- the kind that happen when PostgreSQL restarts, when the network hiccups, or when a connection idles past the server's `idle_in_transaction_session_timeout`. Without this handler, an unhandled error would crash the Node.js process. With it, the error is logged and the pool discards the broken connection, replacing it on the next checkout.

The `connect` handler logs each new connection. This sounds trivial, but it provides a critical diagnostic signal. If the logs show a burst of "New client connected" messages, the pool is churning -- connections are being created and destroyed faster than they should be. That pattern usually means the idle timeout is too aggressive for the workload, or a code path is leaking clients by forgetting to release them.

### SSL on a Private Network

The connection uses SSL, but with a twist: `rejectUnauthorized` is configurable. On an internal network with self-signed certificates, strict certificate validation would require distributing a custom CA to every machine. The pragmatic choice is to encrypt the connection (preventing packet sniffing) without validating the certificate chain (avoiding PKI overhead). This is controlled by a single environment variable.

The SSL configuration follows a two-step check. First: is SSL enabled at all? (`POSTGRES_SSL === "true"`). Second: should the certificate be validated? (`POSTGRES_SSL_REJECT_UNAUTHORIZED !== "false"`). The double-negative is intentional -- the default is to validate, and you must explicitly opt out. This means a deployment that enables SSL without configuring the rejection flag gets the strictest behavior. Only operators who understand the implications of self-signed certificates can disable validation.

For a network that never touches the public internet, encryption-without-validation is a reasonable trade-off. The connection is protected from passive eavesdropping (the most common threat on a shared network), even if it is not protected from an active man-in-the-middle attack (a threat that requires a compromised network device). For a deployment exposed to untrusted networks, you would set rejection to `true` and manage your certificates properly.

### Why Individual Environment Variables

The connection is configured through separate environment variables -- `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DATABASE` -- rather than a single connection string like `postgresql://user:pass@host:5432/db`. This is an operational choice, not a technical one. Individual variables are easier to override independently in different environments. An ops team can change the password without touching the host. A staging environment can point to a different server by changing one variable. Connection strings embed everything into a single opaque blob that must be regenerated entirely when any component changes.

There is also a practical reason specific to this deployment. The production and development environments differ in their database server addresses but share the same schema, user, and port. With individual variables, the deployment script in Chapter 1's CLAUDE.md needs to manage only the `.env` files -- and those files differ by exactly one line (`POSTGRES_HOST`). A connection string would require regenerating the entire URI, which is error-prone when passwords contain special characters that need URL encoding.

---

## Slow Query Tracking

Every query passes through a timing wrapper. If a query takes longer than 500 milliseconds (configurable via `POSTGRES_SLOW_QUERY_MS`), it is logged as a warning with the full SQL text, execution duration, and row count. All queries -- fast and slow -- have their statistics recorded in a circular buffer that holds the last 100 entries.

```typescript
// Pseudocode: Query execution with timing
async query(sql, params) {
  const start = Date.now()
  const result = await pool.query(sql, params)
  const duration = Date.now() - start

  if (duration > SLOW_QUERY_THRESHOLD) {
    warn("SLOW QUERY", { sql, duration, rows: result.rowCount })
  }

  queryStats.push({ sql: sql.substring(0, 200), duration, slow })
  if (queryStats.length > 100) queryStats.shift()

  return result
}
```

The circular buffer is the interesting part. It is not a monitoring system -- there is no alerting, no dashboards, no persistence. It is a diagnostic tool: an API endpoint can return the last 100 queries with their durations, letting an operator spot patterns during an incident. The 200-character SQL truncation prevents parameter values from leaking into diagnostic output while preserving enough of the query shape to identify the offending code path.

The `getQueryStats()` method returns the buffer along with two summary values: the configured threshold and the count of slow queries in the buffer. An operator can poll this endpoint and see "12 of the last 100 queries were slow" without parsing individual entries. That ratio is the single most useful number for database health. If it climbs above 10-15%, something has changed -- a missing index, a table that has grown, a new query pattern introduced by a feature deployment.

### Pool Metrics

The `getPoolMetrics()` method exposes three numbers from the underlying pool: `totalCount` (how many connections exist right now), `idleCount` (how many are not in use), and `waitingCount` (how many requests are queued waiting for a connection). It also reports the configured maximum for context.

These three numbers tell a story:

- **totalCount near max, idleCount near zero, waitingCount zero**: the pool is healthy but busy. Every connection is earning its keep.
- **totalCount near max, idleCount near zero, waitingCount nonzero**: the pool is saturated. Requests are queuing. Either increase `POSTGRES_MAX_POOL` or investigate why queries are holding connections too long.
- **totalCount low, idleCount high**: the pool is oversized for the current workload. Not a problem, but the idle connections consume memory on the PostgreSQL server.
- **totalCount fluctuating rapidly**: connections are being created and destroyed in a churn pattern. Check the idle timeout and the application's connection release behavior.

---

## Helper Functions: The Raw SQL Interface

On top of the singleton pool sit four helper functions that cover the common cases for direct SQL usage:

- **`queryOne<T>(sql, params)`** -- Execute SQL, return the first row or null. Used for lookups by ID or email where you expect zero or one result.
- **`queryMany<T>(sql, params)`** -- Execute SQL, return all rows as an array. Used for listing operations.
- **`execute(sql, params)`** -- Execute SQL, return the affected row count. Used for UPDATE and DELETE where you do not need the modified rows back.
- **`transaction<T>(callback)`** -- Acquire a dedicated client, run BEGIN/callback/COMMIT, ROLLBACK on error, release the client in all cases.

These are thin wrappers. They add type safety (the generic `<T>` parameter) and ergonomics (no need to destructure `.rows[0]` at every call site), but they do not abstract away SQL. The caller writes real SQL with parameterized placeholders. This is the escape hatch for queries that are too complex or too performance-sensitive for the query builder.

Notice what is *not* here: there is no `queryOneOrThrow` that raises an exception on empty results. The helpers consistently return null for missing data, pushing the "is this an error?" decision to the caller. This is a philosophical choice -- the database layer reports what it found; the application layer decides what that means.

```mermaid
graph TD
    A[Application Code] --> B{Query Type?}
    B -->|Lookup by ID| C["queryOne(sql, params)"]
    B -->|List / Search| D["queryMany(sql, params)"]
    B -->|Write without return| E["execute(sql, params)"]
    B -->|Multi-step atomic| F["transaction(callback)"]
    C --> G[db.query]
    D --> G
    E --> G
    F -->|BEGIN / COMMIT / ROLLBACK| G
    G --> H[Connection Pool]
    H --> I[(PostgreSQL)]
    style G fill:#334155,stroke:#60a5fa,color:#e2e8f0
    style I fill:#1e3a2f,stroke:#4ade80,color:#e2e8f0
```

### The Queries Module: Domain Functions over Raw SQL

The `queries` module builds on these helpers to provide domain-specific functions: `getUserById`, `getUserByEmail`, `updateUser`. These functions accept domain objects and return typed results. They are the boundary between "database code" and "application code" -- an API route calls `getUserById(id)` and never sees SQL.

The `updateUser` function demonstrates a pattern used throughout the queries module: dynamic SET clause construction. It iterates over the provided fields, builds a parameterized SET clause for only the fields that are present, and appends `updated_at = NOW()` automatically. This avoids the common pitfall of UPDATE statements that overwrite fields with null because the caller only wanted to change one column. The parameter index counter (`$1`, `$2`, `$3`, ...) is tracked manually across the SET and WHERE clauses, which is fiddly but produces clean parameterized SQL.

The `id` field is explicitly excluded from the SET clause -- you cannot update a user's primary key. This is enforced at the query construction level, not at the database level (though PostgreSQL's primary key constraint would catch it too). Defensive coding at the query layer prevents a round trip to the database just to get an error back.

The pattern of accepting a `Partial<T>` object and building a dynamic SET clause appears dozens of times across the queries module. It is not abstracted into a shared utility, which means each function re-implements the same loop-and-index logic. This is a case where the team chose explicitness over DRY: each update function can add table-specific logic (like the automatic `updated_at`) without navigating a generic abstraction.

There is also a second set of helpers in the `pg-helpers` module that provides slightly different signatures -- `query()` returns rows directly instead of a `QueryResult`, `querySingle()` returns a single row, and `transaction()` uses a simpler callback that does not receive a client parameter. This duplication exists because the two modules were written at different times for different subsystems. The `pg-client` helpers are the canonical ones; the `pg-helpers` module is a convenience layer that some older code paths still use. Both ultimately call the same singleton pool.

---

## The Database Adapter: Supabase Without Supabase

Here is where the architecture gets opinionated. Stick My Note was designed to use the Supabase client API -- the chainable `.from().select().eq()` pattern that Supabase popularized. But Supabase is a hosted service, and the entire premise of this system is self-hosted sovereignty. So the team built a drop-in replacement: a query builder that speaks the same chainable API, but generates raw PostgreSQL queries underneath.

The result is that application code reads like Supabase:

```typescript
// Pseudocode: Query builder usage (looks like Supabase)
const db = await createDatabaseClient()

// Read
const { data, error } = await db.from('users')
  .select('id, email, full_name')
  .eq('organization_id', orgId)
  .order('created_at', { ascending: false })
  .limit(20)

// Write with upsert
const { data, error } = await db.from('settings')
  .upsert({ user_id: userId, theme: 'dark' },
           { onConflict: 'user_id' })
  .single()
```

But underneath, there is no Supabase, no PostgREST, no external service. The query builder translates each chained method call into SQL clauses, accumulating WHERE conditions, ORDER BY, LIMIT, and OFFSET until an execution method is called.

### How the Builder Generates SQL

Each `QueryBuilder` instance is a mutable object that accumulates state: the table name, selected columns, an array of WHERE conditions, an array of parameter values, and a running parameter index counter. Each chained method modifies this state and returns `this`, enabling the fluent API.

The `buildQuery()` method assembles the final SQL string based on which operations were chained. The logic is a priority cascade: if `insertData` is set, generate an INSERT. If `upsertData` is set, generate an INSERT...ON CONFLICT. If `updateData` is set, generate an UPDATE. If `isDelete` is true, generate a DELETE. Otherwise, generate a SELECT. Only one write operation can be active per builder instance -- the last one wins, though in practice the API routes never chain conflicting operations.

The parameter index tracking deserves attention. Each `.eq()`, `.in()`, or `.gte()` call increments the index: the first filter gets `$1`, the second gets `$2`, and so on. But for UPDATE statements, the SET clause also needs parameters. The builder handles this by placing SET values first (`$1` through `$N`), then renumbering the WHERE parameters by adding the offset. This renumbering happens via a regex replacement over the already-built WHERE strings -- a pragmatic approach that works but means the WHERE conditions are built with preliminary indices that get rewritten later.

### The Execution Boundary

The query builder is lazy -- nothing touches the database until you call one of three execution methods:

- **`.single()`** -- Execute and return exactly one row. Returns an error if no rows match. Use this when the caller expects a result and its absence is a problem.
- **`.maybeSingle()`** -- Execute and return one row or null. No error on empty results. Use this when absence is a valid state.
- **`.then()`** -- Execute and return all rows. This makes the builder *thenable*, meaning you can `await` it directly without calling an explicit execution method.

The difference between `.single()` and `.maybeSingle()` is subtle but important. A "get user by ID" should use `.single()` -- if the user does not exist, something is wrong. A "check if user has a setting" should use `.maybeSingle()` -- absence just means the default applies.

Both methods execute the same SQL. The difference is entirely in how they construct the return value. `.single()` returns `{ data: null, error: { message: "No rows found" } }` when the query returns zero rows. `.maybeSingle()` returns `{ data: null, error: null }` for the same result. The calling code can then check `error` to distinguish between "the query failed" and "the query succeeded but found nothing" -- but only if it used `.single()`. With `.maybeSingle()`, both cases return `error: null`, which is the right behavior when absence is expected.

The `.then()` method is the most unusual of the three. By implementing the thenable protocol, the query builder becomes `await`-able without an explicit execution method. You can write `const { data } = await db.from('notes').select('*').eq('org_id', id)` and the builder will execute via its `.then()` method, returning all matching rows. This is syntactic sugar, but it makes the common case -- fetch a list, check for errors -- read naturally.

### Filter Operators

The builder supports sixteen filter operators that map directly to SQL:

| Builder Method | SQL Generated | Use Case |
| --- | --- | --- |
| `.eq(col, val)` | `col = $1` | Exact match |
| `.neq(col, val)` | `col != $1` | Exclusion |
| `.gt / .gte / .lt / .lte` | `> / >= / < / <=` | Range queries |
| `.like / .ilike` | `LIKE / ILIKE` | Pattern matching |
| `.in(col, [...])` | `col IN ($1, $2, ...)` | Set membership |
| `.is(col, null)` | `col IS NULL` | Null checks |
| `.overlaps(col, [...])` | `col && $1` | Array overlap |
| `.contains / .containedBy` | `@> / <@` | Array containment |
| `.or('a.eq.1,b.eq.2')` | `(a = '1' OR b = '2')` | Disjunction |

Every filter except `.or()` uses parameterized queries (`$1`, `$2`, ...) to prevent SQL injection. The `.or()` method parses a string DSL -- the same format Supabase uses -- and inlines values directly into the SQL string. This is a known trade-off: the string DSL provides API compatibility at the cost of parameterized safety for that specific filter.

The `.or()` DSL works by splitting the input string on commas, then splitting each segment on dots to extract `column.operator.value` triples. It maps each operator to its SQL equivalent and joins the results with `OR`, wrapping the whole thing in parentheses. The values are single-quoted in the output SQL, which means they are not parameterized. In practice, the `.or()` method is used with hardcoded filter strings in route handlers (like `"status.eq.active,status.eq.pending"`), not with user input. But the pattern is worth flagging: any future use of `.or()` with user-provided values would need sanitization that the builder does not provide.

The `.not()` operator is also worth noting. It handles three distinct patterns: `.not(col, "is", null)` generates `IS NOT NULL`, `.not(col, "eq", val)` generates `!=`, and `.not(col, "in", [...])` generates `NOT IN`. This multi-dispatch approach avoids separate methods for each negation pattern, but it means the operator parameter is a string rather than a type-checked enum -- another pragmatic trade-off of API compatibility over type safety.

### Insert, Update, Upsert

Write operations follow the same chainable pattern. `INSERT` always appends `RETURNING *` so the caller gets back the created row without a second round trip. `UPSERT` generates `ON CONFLICT (column) DO UPDATE SET ...` with a configurable conflict target that defaults to `id`. This is PostgreSQL's native upsert -- it attempts the insert, and if a unique constraint violation occurs on the conflict column, it updates the existing row instead. `UPDATE` and `DELETE` can include `.select()` to add a `RETURNING` clause, or omit it for a fire-and-forget write.

The builder also supports `.rpc()` for calling PostgreSQL stored procedures. The implementation is straightforward: `SELECT * FROM function_name($1, $2, ...)`. This bridges the gap for operations that are better expressed as database functions -- complex aggregations, recursive queries, or operations that benefit from running closer to the data.

### Count Modes

The `.select()` method accepts an options object with a `count` parameter. Three modes are supported:

- **`"exact"`** -- Runs a separate `COUNT(*)` query alongside the data query. Accurate but doubles the database work.
- **`"planned"`** -- Uses PostgreSQL's `EXPLAIN` to estimate row count without scanning. Fast but approximate.
- **`"estimated"`** -- Same as planned in this implementation.

The `head: true` option skips the data query entirely and returns only the count. This is used for pagination headers where you need "427 total results" without fetching any of them. It is also used for badge counts in the UI -- the Files tab, for instance, shows a count badge that is fetched with `{ count: "exact", head: true }` so the client knows how many files exist without loading any file data.

Note that the "exact" count mode runs a *separate* `COUNT(*)` query, not a `SELECT COUNT(*)` in a subquery. This means the count and the data could be slightly inconsistent if rows are inserted between the two queries. For a collaboration tool where counts are informational (not transactional), this inconsistency is harmless. The alternative -- wrapping both queries in a transaction -- would double the connection hold time for every paginated request.

### The `.range()` Method and Pagination

The builder supports offset-based pagination through `.range(from, to)`. Calling `.range(0, 19)` sets `LIMIT 20 OFFSET 0` -- the first 20 results. Calling `.range(20, 39)` sets `LIMIT 20 OFFSET 20` -- the next page. The conversion from inclusive range to LIMIT/OFFSET is handled internally: `limit = to - from + 1`, `offset = from`.

This is the same API that Supabase provides, and it comes with the same well-known limitation: offset-based pagination degrades on large tables because PostgreSQL must scan and discard `OFFSET` rows before returning results. Page 100 of a million-row table means scanning 99 pages worth of rows and throwing them away. For the typical workload of a team collaboration tool -- where most queries return the first page or two of recent items -- this is acceptable. For tables that could grow unbounded (audit logs, activity feeds), the codebase uses cursor-based pagination with raw SQL instead of the query builder.

### The `.returns<T>()` Type Hint

One method in the builder does nothing at runtime: `.returns<T>()`. It exists purely for TypeScript -- it lets the caller specify the expected return type without affecting the query. The implementation returns `this` unchanged. This is a compatibility shim: Supabase's client uses `.returns<T>()` for type narrowing, and removing it would require changing every call site that uses it. The method costs nothing and keeps the API surface identical.

```mermaid
graph LR
    subgraph "Query Builder Chain"
        A[".from('notes')"] --> B[".select('*')"]
        B --> C[".eq('org_id', id)"]
        C --> D[".order('created_at')"]
        D --> E[".limit(20)"]
    end
    E --> F{Execution Method}
    F -->|".single()"| G["First row or error"]
    F -->|".maybeSingle()"| H["First row or null"]
    F -->|"await (then)"| I["All rows"]
    G --> J[SQL Generation + pg.query]
    H --> J
    I --> J
    style J fill:#334155,stroke:#60a5fa,color:#e2e8f0
```

---

## The Auth Client Wrapper

The database adapter includes an `auth` property that implements `getUser()`, `signUp()`, `signInWithPassword()`, and `signOut()`. This mirrors the Supabase auth client interface, allowing application code that was written against Supabase to work without modification.

The implementation is a facade. `getUser()` reads the session cookie via the local auth module and returns the current user -- no network call, no token refresh, no external identity provider. `signInWithPassword()` delegates to the local auth module (covered in Chapter 4), which handles bcrypt verification, JWT generation, and cookie setting. `signUp()` creates a user record with a hashed password and returns the new user object. `signOut()` clears the session cookie. None of these touch an external auth provider. The interface is Supabase-shaped; the implementation is entirely local.

The practical value of this facade is migration safety. If the team ever decided to move to Supabase (or any other provider with the same API shape), the change would be localized to the adapter module. Every call site in the application -- hundreds of `db.auth.getUser()` invocations -- would continue working without modification. The adapter is the seam between "how we talk to the database" and "whose database we are talking to."

This is the most tangible expression of the sovereignty thesis at the database layer. The code reads `db.auth.getUser()` -- the same call you would write against Supabase -- but the user, the password hash, the session token, and the verification logic all live on your servers.

One subtle detail: the auth methods use dynamic `import()` to load the auth module. This is not laziness -- it is a circular dependency break. The database adapter imports from `pg-client`; the auth module also imports from `pg-client` to verify credentials. If the auth module were imported statically at the top of the adapter file, both would try to resolve each other during module initialization. The dynamic import defers resolution until runtime, when both modules are already loaded.

### Service Client vs. User Client

The codebase exports two factory functions: `createDatabaseClient()` and `createServiceDatabaseClient()`. In the current implementation they return the same object -- both have full access to the database. The distinction is semantic: a "service client" signals that the caller is performing an administrative operation (cleanup jobs, system-generated writes, cross-org queries) where row-level security would be inappropriate. A "user client" signals that the caller is acting on behalf of a specific user and should respect access boundaries.

Today this distinction is enforced by convention, not by the database. The code that calls `createServiceDatabaseClient()` is trusted to make the right queries. A future evolution could enforce this with PostgreSQL's row-level security policies, setting the `current_user` role before each query. The interface is already designed for that split; the implementation just has not caught up.

---

## Transactions and the Consistency Trade-Off

The raw client provides a `transaction<T>()` function that follows the standard pattern: acquire a client from the pool, run `BEGIN`, execute the callback, `COMMIT` on success, `ROLLBACK` on any error, release the client in `finally`. The callback receives the dedicated client so all queries within the transaction share the same connection and see a consistent snapshot.

```typescript
// Pseudocode: Transaction with automatic rollback
async transaction(callback) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await callback(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}
```

But here is what is notable: *most multi-step operations in the codebase do not use transactions*. Creating a note and its default tabs, adding a member to a pad and sending a notification, creating an organization and its initial settings -- these are separate queries executed independently. If the second query fails, the first is already committed.

This is an intentional trade-off, not an oversight. The reasoning: for a collaboration tool where data is user-created and mutable, a partial write is almost always recoverable. If a note is created but its tabs are not, the user sees a note without tabs and can regenerate them. If a member is added but the notification fails, the member still has access -- they just were not notified. The cost of wrapping every multi-step operation in a transaction (connection pinning, increased contention, more complex error handling) was judged higher than the cost of occasional inconsistency.

Transactions are reserved for operations where partial completion would create genuine corruption: financial-like operations, permission changes that must be atomic, or cases where two rows must either both exist or neither exist. The codebase is honest about this: if you see `transaction()`, the developer decided the consistency guarantee was worth the cost.

There is also a pragmatic reason: the query builder does not support transactions. Each `.from().insert()` call acquires and releases a pool connection independently. To use a transaction, you need the raw client layer, which means writing SQL by hand. The ergonomic cost of transactions is not just conceptual -- it requires switching abstraction layers. This friction is, arguably, a feature: it forces developers to consciously choose transactions rather than wrapping everything by default.

### Two Transaction Implementations

Observant readers will notice that the codebase actually has two transaction helpers with slightly different semantics. The `pg-client` version acquires a dedicated `PoolClient`, passes it to the callback, and ensures all queries within the callback use that specific connection. The `pg-helpers` version runs `BEGIN` and `COMMIT`/`ROLLBACK` through the pool's default `query()` method without pinning a client. The difference matters: the `pg-client` version guarantees all queries see the same snapshot; the `pg-helpers` version could theoretically route queries to different pool connections.

In practice, both work for single-statement transactions. For multi-statement transactions, the `pg-client` version is correct. The `pg-helpers` version exists for historical reasons and is used in paths where the "transaction" is really just a single statement with error handling.

This kind of duplication is typical of a codebase that has evolved over time. It is not ideal, but it is also not harmful -- both implementations are correct for their use cases, and the difference is well understood by the team. Consolidating them would require touching every call site of the `pg-helpers` transaction function, with no behavioral change. That refactoring work is perpetually lower priority than building features.

---

## Background Work: The Materialized View Pool

The application uses a materialized view called `social_kb_with_metrics` that pre-computes aggregated metrics for the knowledge base (article views, helpfulness scores, category rollups). Materialized views are PostgreSQL's answer to expensive queries that do not need real-time data: compute the result once, store it as a table, and refresh it periodically.

The refresh runs every five minutes from `server.js` -- not from the Next.js application code. And it uses a *separate* connection pool with a maximum of one connection. This is a deliberate isolation strategy.

Why a separate pool? The main pool serves application queries with up to twenty connections. If the materialized view refresh is slow (it can take seconds on large datasets), it should not compete with application queries for pool slots. But more importantly, the refresh pool has different lifecycle requirements. The main pool is managed by the `PostgresDatabase` class, which is a module-level singleton subject to Next.js module loading behavior. The refresh pool is created in `server.js` and lives for the entire process lifetime, tied to the `setInterval` timer rather than the framework's module system.

The refresh attempts `CONCURRENTLY` first, which allows reads to continue against the old data while the new data is being computed. If that fails (typically because the view lacks a unique index), it falls back to a blocking refresh. Either way, failure is non-critical: if the view cannot be refreshed, the application continues serving slightly stale metrics.

```mermaid
graph TD
    subgraph "server.js"
        T[5-Minute Timer] --> MV[Refresh Pool<br/>max: 1]
    end
    subgraph "Next.js App"
        R[API Routes] --> MP[Main Pool<br/>max: 20]
    end
    MV --> PG[(PostgreSQL)]
    MP --> PG
    style MV fill:#4a3728,stroke:#f59e0b,color:#e2e8f0
    style MP fill:#334155,stroke:#60a5fa,color:#e2e8f0
    style PG fill:#1e3a2f,stroke:#4ade80,color:#e2e8f0
```

This two-pool pattern is worth examining. Many applications would simply run the refresh through the main pool. The risk: a slow refresh occupies a connection for several seconds, and under high load that could be the connection that tips `waitingCount` from zero to nonzero, causing user-facing requests to queue. A dedicated single-connection pool caps the background work's impact at one connection, regardless of how slow the refresh becomes.

Notice that the materialized view pool is created inside `server.js`, not in the database module. This is intentional. The `pg-client` module is loaded by Next.js and subject to its module resolution and hot-reloading behavior. The `server.js` pool is created once in the long-running process and never reloaded. For a background timer that runs every five minutes for the lifetime of the process, you want the simplest possible setup: a pool created once, used on an interval, never invalidated by framework machinery.

The refresh itself is wrapped in a bare `try/catch` that swallows all errors. This is the "fail silently" pattern applied to non-critical work. A failed refresh means the knowledge base metrics are up to five minutes stale -- hardly noticeable in a collaboration tool. Logging the failure would create noise in a healthy system where the view might not even exist yet (it is created by a migration that may not have been run). Silent failure is the right choice here.

Compare this to the main pool's error handling, which logs every error with full context. The difference reflects the different failure modes: a failed application query means a user's request just broke, and the operator needs to know immediately. A failed background refresh means a dashboard widget shows slightly old numbers, and nobody will notice for hours.

---

## The Health Check

The database exposes a simple health check: execute `SELECT NOW()` and report success or failure. This is used by the application's health monitoring endpoint (Chapter 16) to determine whether the database layer is operational. The check confirms three things in a single round trip: the pool can acquire a connection, the connection can reach PostgreSQL, and PostgreSQL can execute a query.

The health check does not verify schema correctness, data integrity, or replication status. It is a liveness probe, not a readiness probe. For a self-hosted deployment where the database is a single server (no replicas, no failover), liveness is the question that matters.

The response includes the connection details (host and port) so that a health dashboard can confirm which database server the application believes it is talking to. This catches a class of misconfiguration where environment variables point to the wrong server -- the health check reports "Connected to PostgreSQL at 192.168.50.30:5432" and the operator can verify that matches expectations.

### The `close()` Method

The database class exposes a `close()` method that terminates all pool connections and sets the pool reference to null. This is used during graceful shutdown: when `server.js` receives a termination signal, it can close the pool before exiting, giving PostgreSQL a clean disconnect rather than a TCP reset. After `close()`, the next call to `getPool()` will create a fresh pool -- the lazy initialization pattern doubles as a reset mechanism.

Clean shutdown matters more than it might seem. PostgreSQL tracks each connection and allocates server-side resources for it. When a client disconnects abruptly (process killed, TCP reset), PostgreSQL eventually cleans up the orphaned connection via its `idle_in_transaction_session_timeout`, but until then the connection slot is occupied. On a server with a limited `max_connections` setting, orphaned connections from a crashed application can represent a significant share of capacity. Calling `close()` on shutdown frees those slots immediately.

---

## Two Layers, One Database

The dual-access pattern -- raw SQL helpers and a chainable query builder -- is not accidental redundancy. Each layer serves a different audience within the codebase:

The **raw SQL layer** (`queryOne`, `queryMany`, `execute`, `transaction`) is used in domain-specific query modules. These are handwritten SQL statements with typed return values. They are used where the query is complex (joins, subqueries, CTEs), where performance matters (the SQL can be tuned precisely), or where the operation is a transaction that needs explicit control over the connection.

The **query builder** (`db.from().select().eq()`) is used in API route handlers. These are CRUD operations where the query is simple enough to express as a chain of filters. The builder handles parameterization, clause ordering, and the `{ data, error }` return shape that the rest of the application expects.

### The Error Shape

Both layers handle errors, but they surface them differently. The raw SQL helpers throw exceptions: if `queryOne()` fails, the caller gets an unhandled promise rejection unless they wrap the call in try/catch. The query builder absorbs errors: if `.single()` fails, the caller gets `{ data: null, error: { message: "..." } }`. Neither approach is strictly better. The raw layer is honest -- failures are exceptional and should be treated as such. The builder is defensive -- failures are expected and should be handled in every response. The `{ data, error }` shape means that every call site must check `error` before using `data`, which prevents a class of bugs where failed queries return stale or undefined values.

This dual error philosophy maps to the two audiences. Domain-specific query modules (using raw SQL) tend to be called from other server-side code that has its own error handling -- they catch exceptions and transform them into application-level errors. API route handlers (using the builder) need to return structured error responses to the client. The builder's `{ data, error }` shape translates directly into an HTTP response body without any transformation.

There is a subtle consequence of the builder's error absorption: a query that fails due to a syntax error, a connection timeout, or a constraint violation all produce the same shape: `{ data: null, error: { message: "..." } }`. The caller can distinguish them only by parsing the error message string, which is fragile. The raw layer, by contrast, propagates the full PostgreSQL error object with its code, detail, and hint fields. If you need precise error handling (for example, detecting a unique constraint violation to return a "duplicate email" message), the raw layer gives you better tools.

The two layers share the same underlying connection pool. A `queryOne()` call and a `db.from().select().single()` call both end up calling `pool.query()` on the same singleton. There is no performance difference; the distinction is ergonomic.

This is the Supabase migration story in reverse. Most teams start with Supabase and eventually need to escape to raw SQL. Stick My Note started with raw SQL and built a Supabase-compatible layer on top -- so that application code could use the simpler API without depending on an external service.

### The Server-Only Guard

The `pg-client` module begins with `import "server-only"` -- a Next.js convention that causes a build error if any client component (or its transitive dependencies) tries to import the module. This is a hard boundary: database access code cannot accidentally end up in the browser bundle. Without this guard, a developer could import `queryOne` into a React component, and the build system would try to bundle the entire `pg` library (a native Node.js module with C bindings) into the client JavaScript. The error would be cryptic. The `server-only` import makes it immediate and clear.

This guard applies to the raw client. The database adapter does not use it directly, but it imports from `pg-client`, which inherits the protection transitively. Any import chain that touches the database is guaranteed to stay on the server.

### When to Use Which Layer

The decision tree for choosing between layers is simpler than it appears:

- **Does the query involve a JOIN, subquery, or CTE?** Use raw SQL. The query builder only supports single-table operations.
- **Does the query need a transaction?** Use raw SQL. The builder cannot pin a connection.
- **Does the query need PostgreSQL-specific syntax** (window functions, recursive CTEs, lateral joins, custom aggregates)? Use raw SQL.
- **Is it a straightforward CRUD operation** on a single table with filters, ordering, and pagination? Use the query builder.
- **Does the response need the `{ data, error }` shape** for direct HTTP response mapping? Use the query builder.

In practice, the split falls roughly along module boundaries. The `queries` module, the `stick-chat-queries` module, and the migration helpers use raw SQL. The API route handlers in `app/api/` predominantly use the query builder. New code should follow this convention: if you are writing an API route that does a simple read or write, use the builder; if you are writing a shared function that will be called from multiple places with complex logic, use raw SQL.

```mermaid
graph TD
    subgraph "Choosing the Right Layer"
        Q{Query Complexity?}
        Q -->|Simple CRUD| QB["Query Builder<br/>.from().select().eq()"]
        Q -->|JOINs / CTEs / Transactions| RS["Raw SQL<br/>queryOne / queryMany / execute"]
        QB --> P[Connection Pool]
        RS --> P
        P --> DB[(PostgreSQL)]
    end
    style QB fill:#1e3a5f,stroke:#60a5fa,color:#e2e8f0
    style RS fill:#3a1e5f,stroke:#a78bfa,color:#e2e8f0
    style P fill:#334155,stroke:#60a5fa,color:#e2e8f0
    style DB fill:#1e3a2f,stroke:#4ade80,color:#e2e8f0
```

---

## What the Database Layer Does Not Do

It is worth noting what is *absent* from this layer, because the omissions are as revealing as the implementations.

**No ORM.** There is no Prisma, no Drizzle, no TypeORM. The team chose to write SQL directly (in the raw layer) or use a thin query builder (in the adapter layer). The rationale: ORMs add a layer of abstraction that makes simple queries easier but makes complex queries harder. For a codebase that needs both simple CRUD and complex PostgreSQL-specific queries (materialized views, JSONB operations, array operators), an ORM would require constant escape-hatching. Better to start at the SQL level and add convenience on top than to start at the ORM level and fight it on the way down.

**No connection string parsing.** The configuration does not accept `DATABASE_URL` or any other single-string format. This means the database layer cannot be pointed at a cloud-hosted PostgreSQL instance just by setting one variable (the way Heroku or Railway provisions databases). This is not a limitation -- it is a statement. The system is designed for infrastructure that you control, where you know the host, port, and credentials individually because you configured them individually.

**No read replicas.** The pool connects to a single PostgreSQL server. There is no read/write splitting, no routing of SELECT queries to a replica. For a team collaboration tool with tens of concurrent users, a single PostgreSQL instance handles the load comfortably. The pool's 20-connection limit is the primary scaling knob, and it has headroom. If the system ever needed read replicas, the singleton pattern would need to become a pair of pools (one read-write, one read-only), and the query helpers would need a `readonly` parameter. The interface does not preclude this evolution, but it does not accommodate it either.

**No query caching at the database layer.** The raw client and the query builder execute every query against PostgreSQL every time. Caching happens elsewhere -- in the four-layer caching system covered in Chapter 3. The database layer is deliberately stateless: it translates method calls into SQL, sends them to PostgreSQL, and returns results. Keeping caching out of this layer means the database always returns fresh data, and caching decisions are made by the layers that understand the business context (how long is this data valid? when should it be invalidated?).

**No automatic retry.** If a query fails due to a transient error (network timeout, connection reset, deadlock), the database layer propagates the error to the caller. It does not retry. This is a conscious decision rooted in the self-hosted context: on a private network with a dedicated database server, transient errors are rare and usually indicate a real problem (server restart, network reconfiguration) rather than a momentary glitch. Automatic retries would mask these signals. The caller -- typically an API route handler -- can decide whether to retry, return an error to the client, or fall back to cached data. That decision depends on context the database layer does not have.

**No schema management.** The database layer does not run migrations, validate schemas, or create tables. Schema changes are managed through separate SQL migration scripts that are run manually during deployment. This keeps the application code decoupled from the schema lifecycle: the application assumes the schema exists and is correct; the deployment process ensures it. The migration helpers module provides utilities for running SQL files, but it is a deployment tool, not a runtime dependency.

**No prepared statements.** The raw client sends each query as a fresh SQL string. PostgreSQL will plan it each time. For a system with diverse query patterns and moderate throughput, the planning overhead is negligible compared to the I/O time. Prepared statements would add complexity (managing statement lifecycles, invalidating on schema changes) for marginal benefit. If profiling ever showed that query planning was a bottleneck, prepared statements could be added at the pool level without changing the application code -- the `pg` library supports them natively with a `name` parameter.

These omissions define the layer's philosophy: do one thing well (get data in and out of PostgreSQL), do it with the minimum viable abstraction, and leave everything else to the layers above and the deployment processes around it. The database layer is a pipe, not a platform.

---

## Apply This

**1. Singleton pool with lazy initialization.** Create the connection pool on first use, not at module load time. This avoids pool creation during build steps, testing, or other contexts where the database is unreachable. The `getPool()` pattern ensures the pool exists exactly when it is needed and not before. Export the singleton as a module-level constant so that every import gets the same instance. Pair it with a `close()` method that nulls the reference, enabling both clean shutdown and fresh restart.

**Corollary: Export a class instance, not a class.** Application code should never call `new PostgresDatabase()`. Export `db` as the singleton, and keep the class private. This prevents accidental creation of multiple pools, which would fragment the connection budget and make pool metrics meaningless.

**2. Separate pools for background work.** Any periodic task that might run slow queries -- view refreshes, report generation, cleanup jobs -- should use its own pool with a low connection limit. This isolates background work from user-facing traffic. The cost is one extra connection; the benefit is predictable application latency. Create the background pool in your process entry point (not in a framework module) so its lifecycle matches the process, not the framework's module system.

**3. Circular buffer diagnostics over full telemetry.** Not every system needs Datadog. A 100-entry circular buffer of recent query stats, exposed through an internal API, gives operators enough information to diagnose incidents without the overhead of shipping metrics to an external service. Pair it with a configurable slow-query threshold for targeted warnings. The key insight: the ratio of slow queries to total queries in the buffer is a single number that captures database health better than any dashboard.

**Bonus: Truncate diagnostic data.** The 200-character SQL truncation in the query stats is a pattern worth copying. Full SQL strings in diagnostic output risk leaking sensitive parameter values (emails, tokens, password hashes). Truncation preserves the query shape -- enough to identify the code path -- while discarding the specifics. Apply this to any system that logs or exposes query information.

**4. The `.single()` vs. `.maybeSingle()` convention.** Encode your expectations in the query. If the absence of a row is an error, use a method that returns an error. If absence is a valid state, use a method that returns null. This pushes domain logic into the data access layer, where it prevents a class of bugs at every call site. The convention should be team-wide: if every developer understands the distinction, code reviews can catch misuse ("this lookup uses `.maybeSingle()` but the route returns 404 on null -- it should use `.single()`").

**5. Transactions only where corruption matters.** Wrapping every multi-step operation in a transaction is defensive but expensive. For user-generated content in a collaboration tool, partial writes are usually recoverable. Reserve transactions for operations where partial completion would create states that no subsequent operation can fix. Use the cost of switching abstraction layers (from builder to raw SQL) as a forcing function: if a developer has to drop down to raw SQL to get a transaction, they will think carefully about whether they actually need one.

---

*The database layer gives the application two ways to talk to PostgreSQL and one way to know if it is healthy. Twenty connections in the main pool, one in the background pool, a query builder that speaks Supabase's language, and raw SQL helpers for everything else. The pool is the foundation; everything above it is ergonomics.*

*But between the application and the database sits another layer -- one that most requests hit before they ever reach PostgreSQL. If the database layer is about getting data reliably, the caching layer is about not getting data at all. Chapter 3 explores the four-layer caching system that keeps the database from doing work it has already done.*

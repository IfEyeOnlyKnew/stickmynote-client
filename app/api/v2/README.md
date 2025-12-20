# V2 API Routes

## Overview

The `v2` folder contains production-quality API routes that have been migrated from the legacy patterns used elsewhere in the codebase. These routes follow a consistent, standardized approach optimized for performance, security, and maintainability.

## Why V2?

### Background

The original API routes were developed during a migration away from Supabase to a self-hosted PostgreSQL database with local authentication. During this transition, various patterns emerged:

1. **Database Adapter Pattern** - Routes using `createDatabaseClient()` from `@/lib/database/database-adapter` which provided a Supabase-compatible API wrapper
2. **Mixed Response Patterns** - Some routes used `NextResponse.json()`, others used `new Response()`
3. **Inconsistent Auth Handling** - Different approaches to authentication and rate limiting
4. **Various Error Handling** - No standardized error response format

### The V2 Solution

Rather than refactoring routes in-place (which risked breaking existing functionality), we created a parallel `v2` folder with routes that follow a single, optimized pattern. This allows for:

- **Gradual Migration** - Frontend code can be updated to use v2 endpoints incrementally
- **Easy Rollback** - Legacy routes remain available if issues arise
- **Clear Separation** - New development follows v2 patterns exclusively

## V2 Pattern Standard

All v2 routes follow this structure:

```typescript
// v2 [Feature] API: production-quality, [description]
import { type NextRequest } from 'next/server'
import { db } from '@/lib/database/pg-client'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { getOrgContext } from '@/lib/auth/get-org-context'
import { handleApiError } from '@/lib/api/handle-api-error'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // 1. Auth check with rate limiting
    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }),
        { status: 429, headers: { 'Retry-After': '30' } }
      )
    }
    if (!authResult.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }
    const user = authResult.user

    // 2. Org context (if needed)
    const orgContext = await getOrgContext()
    if (!orgContext) {
      return new Response(JSON.stringify({ error: 'No organization context' }), { status: 403 })
    }

    // 3. Direct PostgreSQL queries with parameterized values
    const result = await db.query(
      `SELECT * FROM table WHERE user_id = $1 AND org_id = $2`,
      [user.id, orgContext.orgId]
    )

    // 4. Consistent response format
    return new Response(JSON.stringify({ data: result.rows }), { status: 200 })
  } catch (error) {
    // 5. Centralized error handling
    return handleApiError(error)
  }
}
```

### Key Characteristics

| Aspect | V2 Pattern | Legacy Pattern |
|--------|------------|----------------|
| Database | Direct `db.query()` with parameterized SQL | `createDatabaseClient()` with Supabase-style chaining |
| Responses | `new Response(JSON.stringify())` | `NextResponse.json()` |
| Auth | `getCachedAuthUser()` with rate limit check | Various (`getSession()`, direct checks) |
| Errors | `handleApiError()` | Inline `console.error` + custom responses |
| Dynamic | `export const dynamic = 'force-dynamic'` | Sometimes missing |
| Params | `{ params }: { params: Promise<{ id: string }> }` | Mixed (some async, some not) |

## Route Categories

### Currently Migrated

- **Auth Routes** - signin, signout, session, reset-password
- **Admin Routes** - user-lookup, unlock-account, create-hub
- **AI Routes** - ask, summarize, generate-subtasks, check-duplicate, etc.
- **Calsticks Routes** - CRUD, archive, budget, workload, dependencies, etc.
- **Social Pads Routes** - CRUD, members, sticks, knowledge-base, etc.
- **Social Sticks Routes** - CRUD, replies, reactions, workflow, etc.
- **Sticks Routes** - CRUD, tabs, members, replies, export
- **Notes Routes** - CRUD, bookmark, like, view-count, tags, replies
- **Search Routes** - advanced, notes, pads, sticks, panel, suggestions
- **Saved Searches/Emails** - CRUD operations
- **Notifications** - CRUD, mark-read, mark-all-read
- **Webhooks** - config, logs, test, replay
- **Automation** - rules, reminders, recurring, execute-reminders
- **Escalations** - rules, acknowledge, snooze
- **Time Entries** - CRUD, start, stop, active
- **Templates** - pad-templates, stick-templates
- **Digests** - preview, send-test
- **Preferences** - notification-preferences, muted-items
- **Invites** - accept-by-token, pad-invites

## Migration Guide

### For Frontend Developers

When updating frontend code to use v2 endpoints:

```typescript
// Before
const response = await fetch('/api/notifications')

// After
const response = await fetch('/api/v2/notifications')
```

Response formats remain compatible - the main difference is in error handling consistency.

### For Backend Developers

When creating new API routes, always use the v2 pattern:

1. Create the route in `app/api/v2/[feature]/route.ts`
2. Follow the standard template above
3. Use parameterized queries (`$1`, `$2`) - never string interpolation
4. Include rate limiting and auth checks
5. Use `handleApiError()` for all catch blocks

## Security Considerations

V2 routes include several security improvements:

1. **Parameterized Queries** - All SQL uses `$1, $2` placeholders, preventing SQL injection
2. **Rate Limiting** - Built into auth check, returns 429 with Retry-After header
3. **Org Context Validation** - Multi-tenant isolation enforced at route level
4. **Consistent Auth** - No routes accidentally skip authentication
5. **Error Sanitization** - `handleApiError()` prevents leaking internal details

## Future Plans

1. **Complete Migration** - Remaining legacy routes will be migrated to v2
2. **Deprecation** - Legacy routes will be marked deprecated after frontend migration
3. **Removal** - Legacy routes will be removed in a future major version
4. **API Versioning** - v2 establishes the pattern for future API versions (v3, etc.)

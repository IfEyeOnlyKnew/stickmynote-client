# StickMyNote API Rewrite Architecture (2025)

## Goals
- Eliminate all Supabase dependencies
- Use PostgreSQL directly for all data access
- Use Active Directory (AD) for authentication and user provisioning
- Consistent, maintainable, and secure API design
- Modern error handling, validation, and caching

## Structure

- `lib/api/` — Shared API utilities (auth, db, org context, error handling)
- `lib/database/pg-helpers.ts` — Reusable PostgreSQL query helpers (CRUD, transactions, pagination)
- `lib/auth/ad-session.ts` — AD session and JWT management
- `app/api/` — All API routes, rewritten to use new helpers and AD context

## Route Pattern Example
```ts
// app/api/notes/route.ts
import { requireADSession } from '@/lib/auth/ad-session'
import { db } from '@/lib/database/pg-helpers'

export async function GET(request) {
  const session = await requireADSession(request)
  // ... use db helpers for queries ...
}
```

## Shared Utilities
- `requireADSession(request)` — Ensures valid AD session, returns user context
- `db.query(sql, params)` — Typed query helper
- `db.transaction(fn)` — Transaction helper
- `handleApiError(error)` — Consistent error response

## Next Steps
1. Scaffold `lib/api/` and `lib/database/pg-helpers.ts`
2. Implement `requireADSession` and session helpers
3. Rewrite core routes (notes, pads, sticks, search, social, invites)
4. Add tests and remove legacy code

---
This file will be updated as the rewrite progresses.

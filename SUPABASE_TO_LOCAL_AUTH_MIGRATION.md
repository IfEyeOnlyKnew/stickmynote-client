# Supabase to Local PostgreSQL Authentication Migration

## Status: IN PROGRESS

This document tracks the migration from Supabase Auth to local PostgreSQL-based JWT authentication.

## Environment Setup

✅ **Completed:**
- Added `USE_LOCAL_DATABASE=true` to .env
- Added `USE_LOCAL_AUTH=true` to .env  
- Added `JWT_SECRET` to .env
- Local auth system exists at `lib/auth/local-auth.ts`

## Migration Strategy

### Phase 1: Core Authentication Infrastructure
- [x] Environment variables configured
- [ ] Update authentication helper functions
- [ ] Update middleware to use local auth
- [ ] Update auth utilities

### Phase 2: API Routes (Priority Order)
High Priority (Auth & User Management):
- [ ] `app/api/auth/*` - Authentication endpoints
- [ ] `app/auth/*` - Auth pages
- [ ] `lib/auth-utils.ts` - Auth utility functions
- [ ] `contexts/user-context.tsx` - User context provider
- [ ] `hooks/useAuth.ts` - Auth hooks
- [ ] `hooks/use-auth-form.ts` - Auth form hooks

Medium Priority (Core Features):
- [ ] `app/api/personal/*` - Notes management
- [ ] `app/api/sticks/*` - Sticks management  
- [ ] `app/api/social-sticks/*` - Social features
- [ ] `app/api/organizations/*` - Organization management
- [ ] `app/api/ai/*` - AI features

Low Priority (Secondary Features):
- [ ] Search endpoints
- [ ] Admin endpoints
- [ ] Analytics endpoints

### Phase 3: Client Components
- [ ] Update all client-side auth calls
- [ ] Remove Supabase client dependency from client components

### Phase 4: Testing & Cleanup
- [ ] Test authentication flow
- [ ] Test API endpoints
- [ ] Remove unused Supabase imports
- [ ] Update package.json dependencies (optional)

## Key Changes Required

### Authentication Pattern Changes

**OLD (Supabase):**
```typescript
const supabase = await createClient()
const { data: { user }, error } = await supabase.auth.getUser()
if (error || !user) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
}
```

**NEW (Local Auth):**
```typescript
import { getSession } from "@/lib/auth/local-auth"

const session = await getSession()
if (!session) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
}
const user = session.user
```

### Client-Side Pattern Changes

**OLD (Supabase Client):**
```typescript
import { createClient } from "@/lib/supabase/client"

const supabase = createClient()
const { data: { user } } = await supabase.auth.getUser()
```

**NEW (API Call):**
```typescript
const response = await fetch('/api/auth/session')
const { user } = await response.json()
```

## Files to Migrate

### Critical Files (Must migrate first):
1. `middleware.ts` - Already partially supports local auth
2. `lib/auth-utils.ts` - Auth helper functions
3. `lib/auth/cached-auth.ts` - Cached auth functions
4. `contexts/user-context.tsx` - User context
5. `hooks/useAuth.ts` - Auth hook

### API Route Files (100+ files):
Use pattern: Find all `supabase.auth.getUser()` calls and replace with `getSession()`

### Components (50+ files):
Update all client-side auth checks to use API calls or context

## Database Schema Requirements

Ensure `users` table has:
- `id` (UUID primary key)
- `email` (unique, not null)
- `password_hash` (text, not null)
- `full_name` (text)
- `avatar_url` (text)
- `email_verified` (boolean, default false)
- `created_at` (timestamp)
- `updated_at` (timestamp)

## Testing Checklist

- [ ] Sign up new user
- [ ] Sign in with email/password
- [ ] Session persistence
- [ ] Logout
- [ ] Protected routes redirect properly
- [ ] API authentication works
- [ ] User context updates properly

## Notes

- Keep local auth in `lib/auth/local-auth.ts`
- Session uses JWT stored in httpOnly cookie
- Session duration: 7 days
- Cookie name: `session`

## Next Steps

1. Create auth helper wrapper for easy migration
2. Migrate critical files first
3. Test auth flow works
4. Migrate API routes in batches
5. Migrate client components
6. Clean up Supabase dependencies

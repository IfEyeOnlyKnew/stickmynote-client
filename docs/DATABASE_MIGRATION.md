# Database Migration: Supabase to PostgreSQL

## Overview

This application is being migrated from Supabase to direct PostgreSQL connections while **keeping Supabase Auth** for authentication.

## Migration Strategy

### What We're Keeping
- ✅ **Supabase Auth** - Complete authentication system (sign-in, sign-up, password reset, email verification)
- ✅ **Supabase Client** - Only for auth operations (`supabase.auth.*`)

### What We're Migrating
- 🔄 **Database Queries** - All `.from()` queries moved to direct PostgreSQL
- 🔄 **RLS (Row Level Security)** - Handled in application layer
- 🔄 **Realtime** - Will use pg-listen or similar if needed

## New Database Layer

### Core Files

#### `lib/database/pg-client.ts`
- PostgreSQL connection pool with SSL support
- Singleton pattern for connection management
- Helper functions: `query()`, `queryOne()`, `queryMany()`, `execute()`
- Transaction support

#### `lib/database/queries.ts`
- Typed query functions for all database operations
- Replaces Supabase query builders
- Type-safe with TypeScript interfaces
- Examples:
  ```typescript
  // Old Supabase way
  const { data } = await supabase.from("users").select("*").eq("id", userId)
  
  // New PostgreSQL way
  const data = await getUserById(userId)
  ```

## Migration Progress

### ✅ Completed

1. **Core Infrastructure**
   - PostgreSQL connection pool
   - SSL configuration
   - Connection testing (pnpm test:db)
   - Schema export tool (pnpm export:schema)
   - SQL runner (pnpm sql:run)

2. **Database Query Library**
   - User queries (getUserById, updateUser)
   - Personal sticks (CRUD operations)
   - Replies and tabs
   - Organization queries
   - AI session tracking
   - User preferences
   - Search history
   - Rate limiting

3. **Migrated Files**
   - ✅ `app/api/ai/ask/route.ts` - AI endpoint using PostgreSQL
   - ✅ `contexts/user-context.tsx` - User profile from PostgreSQL
   - ✅ `lib/database/queries.ts` - Complete query library

### 🔄 In Progress

The following files still use Supabase `.from()` queries and need migration:

#### High Priority
- `contexts/organization-context.tsx` - Organization management
- `hooks/useNotesData.ts` - Notes CRUD
- `hooks/useUserProfile.ts` - User profile management
- `hooks/use-settings.ts` - User settings
- `lib/notes.ts` - Core notes functions

#### Medium Priority
- `hooks/useReplyManagement.ts` - Reply management
- `hooks/useTeamNoteBusinessLogic.ts` - Team notes
- `lib/rate-limiter.ts` - Rate limiting
- `lib/search-engine.ts` - Search functionality
- `lib/search-analytics.ts` - Search tracking

#### Low Priority
- `lib/optimized-search.ts` - Advanced search
- `lib/data/*.ts` - Data access layer
- `lib/community-notes.ts` - Community features
- `lib/automation-engine.tsx` - Automation rules

## How to Migrate a File

### Step 1: Import the Query Functions
```typescript
import {
  getUserById,
  getPersonalSticks,
  createPersonalStick,
  updatePersonalStick,
  deletePersonalStick,
} from "@/lib/database/queries"
```

### Step 2: Replace Supabase Queries

**Before:**
```typescript
const { data, error } = await supabase
  .from("personal_sticks")
  .select("*")
  .eq("user_id", userId)

if (error) throw error
```

**After:**
```typescript
const data = await getPersonalSticks(userId)
// Errors are thrown automatically, no need to check
```

### Step 3: Handle Errors
```typescript
try {
  const data = await getPersonalSticks(userId)
  // Success
} catch (error) {
  console.error("Failed to fetch sticks:", error)
  // Handle error
}
```

### Step 4: Test
```bash
# Test database connection
pnpm test:db

# Run your development server
pnpm dev

# Check for errors in the console
```

## Authentication Flow

### Sign In/Sign Out - KEEP USING SUPABASE
```typescript
// Auth operations still use Supabase
const supabase = createClient()

// Sign in
const { data, error } = await supabase.auth.signInWithPassword({
  email,
  password,
})

// Sign out
await supabase.auth.signOut()

// Get current user
const { data: { user } } = await supabase.auth.getUser()
```

### User Profile - USE POSTGRESQL
```typescript
// Once authenticated, get user profile from PostgreSQL
const profile = await getUserById(user.id)
```

## Adding New Queries

When you need to add a new query function to `lib/database/queries.ts`:

```typescript
export interface YourTable extends QueryResultRow {
  id: string
  // ... other fields
  created_at: string
}

export async function getYourData(id: string): Promise<YourTable | null> {
  return queryOne<YourTable>(
    "SELECT * FROM your_table WHERE id = $1",
    [id]
  )
}

export async function createYourData(data: Omit<YourTable, "id" | "created_at">): Promise<YourTable | null> {
  return queryOne<YourTable>(
    "INSERT INTO your_table (field1, field2) VALUES ($1, $2) RETURNING *",
    [data.field1, data.field2]
  )
}
```

## Environment Variables

Required in `.env.local`:

```bash
# PostgreSQL Connection
POSTGRES_HOST=HOL-DC3-PGSQL.stickmynote.com
POSTGRES_PORT=5432
POSTGRES_DATABASE=stickmynote
POSTGRES_USER=stickmynote_user
POSTGRES_PASSWORD=your_password
POSTGRES_SSL=true
POSTGRES_SSL_REJECT_UNAUTHORIZED=false

# Supabase (for Auth only)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_key
```

## Common Patterns

### Pagination
```typescript
// Old
const { data } = await supabase
  .from("table")
  .select("*")
  .range(0, 9)

// New - add pagination to query function
export async function getItems(page = 1, perPage = 10) {
  const offset = (page - 1) * perPage
  return queryMany(
    "SELECT * FROM table LIMIT $1 OFFSET $2",
    [perPage, offset]
  )
}
```

### Filtering
```typescript
// Old
const { data } = await supabase
  .from("table")
  .select("*")
  .eq("category", "work")
  .gt("created_at", date)

// New
const data = await queryMany(
  "SELECT * FROM table WHERE category = $1 AND created_at > $2",
  ["work", date]
)
```

### Ordering
```typescript
// Old
const { data } = await supabase
  .from("table")
  .select("*")
  .order("created_at", { ascending: false })

// New
const data = await queryMany(
  "SELECT * FROM table ORDER BY created_at DESC"
)
```

### Joins
```typescript
// Old
const { data } = await supabase
  .from("posts")
  .select(`
    *,
    users (username, email)
  `)

// New
const data = await queryMany(`
  SELECT posts.*, users.username, users.email
  FROM posts
  JOIN users ON posts.user_id = users.id
`)
```

## Rollback Plan

If issues arise:

1. Keep both Supabase and PostgreSQL connections active
2. Use feature flags to switch between implementations
3. Monitor for errors in production
4. Can revert individual files back to Supabase queries

## Testing

### Manual Testing
```bash
# Test database connection
pnpm test:db

# Export schema to verify tables
pnpm export:schema

# Run SQL queries
pnpm sql:run "SELECT COUNT(*) FROM users"
```

### Automated Testing
- Add integration tests for query functions
- Test error handling
- Verify data types match database schema

## Performance Considerations

### Connection Pooling
- Max 20 connections in pool
- 30s idle timeout
- 10s connection timeout

### Query Optimization
- Use indexes on frequently queried columns
- Avoid N+1 queries (use JOINs)
- Limit result sets appropriately
- Cache frequently accessed data

## Security

### SQL Injection Prevention
- ✅ Always use parameterized queries (`$1`, `$2`)
- ❌ Never concatenate user input into SQL strings

### Access Control
- Implement authorization checks in application code
- Verify user ownership before operations
- Use transactions for atomic operations

## Next Steps

1. Continue migrating hooks and contexts
2. Add more query functions as needed
3. Implement connection monitoring
4. Set up query performance tracking
5. Add integration tests
6. Document any custom patterns
7. Plan for production deployment

## Support

- Database connection issues: Check `docs/POSTGRESQL_REMOTE_SETUP.md`
- SSL certificate issues: Check `docs/POSTGRESQL_SSL_SETUP.md`
- Schema changes: Use `pnpm export:schema` to document structure
- Query testing: Use `pnpm sql:run` for ad-hoc queries

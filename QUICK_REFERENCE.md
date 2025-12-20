# Quick Reference: PostgreSQL Migration

## Import Statement

```typescript
import {
  // Users
  getUserById,
  getUserByEmail,
  updateUser,
  
  // Personal Sticks (Notes)
  getPersonalSticks,
  getPersonalStickById,
  createPersonalStick,
  updatePersonalStick,
  deletePersonalStick,
  deleteAllPersonalSticks,
  
  // Replies
  getStickReplies,
  createStickReply,
  updateStickReply,
  deleteStickReply,
  
  // Tabs
  getStickTabs,
  createStickTab,
  updateStickTab,
  deleteStickTab,
  
  // Organizations
  getOrganizationMember,
  getUserOrganizations,
  getUserOrganizationsWithDetails,
  getOrganizationById,
  createOrganization,
  createOrganizationMember,
  
  // AI Sessions
  createAISession,
  countAISessionsToday,
  
  // Preferences
  getUserPreferences,
  upsertUserPreferences,
  
  // Search
  createSearchHistory,
  getRecentSearchHistory,
  updateSearchHistory,
  
  // Rate Limiting
  getRateLimitCount,
  createRateLimit,
  cleanupOldRateLimits,
  
  // Transactions
  createStickWithTabs,
  
  // Raw queries
  queryOne,
  queryMany,
  execute,
  db,
} from "@/lib/database/queries"
```

## Common Patterns

### Get User
```typescript
// ❌ Old
const { data } = await supabase.from("users").select("*").eq("id", userId).single()

// ✅ New
const user = await getUserById(userId)
```

### Get All Notes
```typescript
// ❌ Old
const { data } = await supabase
  .from("personal_sticks")
  .select("*")
  .eq("user_id", userId)
  .order("created_at", { ascending: false })

// ✅ New
const notes = await getPersonalSticks(userId, {
  orderBy: "created_at DESC"
})
```

### Create Note
```typescript
// ❌ Old
const { data } = await supabase
  .from("personal_sticks")
  .insert({
    user_id: userId,
    title: "My Note",
    content: "Content here"
  })
  .select()
  .single()

// ✅ New
const note = await createPersonalStick({
  user_id: userId,
  title: "My Note",
  content: "Content here"
})
```

### Update Note
```typescript
// ❌ Old
const { data } = await supabase
  .from("personal_sticks")
  .update({ title: "New Title" })
  .eq("id", noteId)
  .eq("user_id", userId)
  .select()
  .single()

// ✅ New
const note = await updatePersonalStick(noteId, userId, {
  title: "New Title"
})
```

### Delete Note
```typescript
// ❌ Old
const { error } = await supabase
  .from("personal_sticks")
  .delete()
  .eq("id", noteId)
  .eq("user_id", userId)

// ✅ New
const deletedCount = await deletePersonalStick(noteId, userId)
// Returns number of rows deleted (0 or 1)
```

### Count Records
```typescript
// ❌ Old
const { count } = await supabase
  .from("personal_sticks")
  .select("*", { count: "exact", head: true })
  .eq("user_id", userId)

// ✅ New
const result = await queryOne<{ count: string }>(
  "SELECT COUNT(*) as count FROM personal_sticks WHERE user_id = $1",
  [userId]
)
const count = result ? Number.parseInt(result.count, 10) : 0
```

### Custom Query
```typescript
// When you need a custom query not in queries.ts

// ✅ Single row
const result = await queryOne<MyType>(
  "SELECT * FROM table WHERE id = $1",
  [id]
)

// ✅ Multiple rows
const results = await queryMany<MyType>(
  "SELECT * FROM table WHERE user_id = $1",
  [userId]
)

// ✅ Insert/Update/Delete (don't need result)
const rowsAffected = await execute(
  "DELETE FROM table WHERE id = $1",
  [id]
)
```

### Transactions
```typescript
// ❌ Old - Multiple queries, no transaction safety
const { data: stick } = await supabase.from("personal_sticks").insert(stickData).select().single()
const { data: tab1 } = await supabase.from("personal_sticks_tabs").insert({ stick_id: stick.id, ...tab1Data })
const { data: tab2 } = await supabase.from("personal_sticks_tabs").insert({ stick_id: stick.id, ...tab2Data })

// ✅ New - Atomic transaction
const result = await createStickWithTabs(
  { user_id: userId, title: "Note", content: "..." },
  [
    { title: "Tab 1", content: "..." },
    { title: "Tab 2", content: "..." }
  ]
)
// result = { stick: PersonalStick, tabs: PersonalStickTab[] }
```

### Raw Transaction
```typescript
const result = await db.transaction(async (client) => {
  // All queries here are in same transaction
  const user = await client.query("SELECT * FROM users WHERE id = $1", [userId])
  await client.query("UPDATE users SET last_seen = NOW() WHERE id = $1", [userId])
  await client.query("INSERT INTO audit_log (user_id, action) VALUES ($1, $2)", [userId, "login"])
  
  return user.rows[0]
})
```

## Error Handling

All query functions throw errors automatically:

```typescript
try {
  const note = await getPersonalStickById(noteId, userId)
  if (!note) {
    // Not found
    return { error: "Note not found" }
  }
  // Success
  return { data: note }
} catch (error) {
  console.error("Database error:", error)
  return { error: "Failed to fetch note" }
}
```

## Authentication

**KEEP using Supabase for auth:**

```typescript
// ✅ Still use Supabase
const supabase = createClient()

// Sign in
const { data, error } = await supabase.auth.signInWithPassword({ email, password })

// Sign out
await supabase.auth.signOut()

// Get user
const { data: { user } } = await supabase.auth.getUser()

// Listen to auth changes
supabase.auth.onAuthStateChange((event, session) => {
  // Handle auth state
})
```

**Then fetch profile from PostgreSQL:**

```typescript
const profile = await getUserById(user.id)
```

## Type Safety

All query functions are fully typed:

```typescript
// TypeScript knows the return type
const user: User | null = await getUserById(userId)
const notes: PersonalStick[] = await getPersonalSticks(userId)
```

## Testing

```bash
# Test database connection
pnpm test:db

# Export schema
pnpm export:schema

# Run custom SQL
pnpm sql:run "SELECT COUNT(*) FROM users"

# Test migration
./scripts/test-migration.ps1

# Start dev server
pnpm dev
```

## Adding New Query Functions

Edit `lib/database/queries.ts`:

```typescript
// 1. Define interface
export interface MyTable extends QueryResultRow {
  id: string
  name: string
  created_at: string
}

// 2. Add query function
export async function getMyData(id: string): Promise<MyTable | null> {
  return queryOne<MyTable>(
    "SELECT * FROM my_table WHERE id = $1",
    [id]
  )
}

// 3. Use in your code
import { getMyData } from "@/lib/database/queries"
const data = await getMyData(id)
```

## Common Issues

### Issue: "relation does not exist"
**Solution:** Table name is case-sensitive, use lowercase

### Issue: "column does not exist"
**Solution:** Check column names with `pnpm export:schema`

### Issue: Type mismatch
**Solution:** Ensure interface matches database schema exactly

### Issue: Connection timeout
**Solution:** Check SSL settings in `.env.local`

### Issue: Too many connections
**Solution:** Pool automatically manages connections (max 20)

## Environment Variables

Required in `.env.local`:

```bash
# PostgreSQL
POSTGRES_HOST=HOL-DC3-PGSQL.stickmynote.com
POSTGRES_PORT=5432
POSTGRES_DATABASE=stickmynote
POSTGRES_USER=stickmynote_user
POSTGRES_PASSWORD=your_password
POSTGRES_SSL=true
POSTGRES_SSL_REJECT_UNAUTHORIZED=false

# Supabase (for auth only)
NEXT_PUBLIC_SUPABASE_URL=your_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key
```

## Performance Tips

1. **Use indexes** on frequently queried columns
2. **Limit results** with `LIMIT` clause
3. **Avoid N+1** queries - use JOINs
4. **Cache** frequently accessed data
5. **Monitor** query execution times in logs

## Migration Checklist

When migrating a file:

- [ ] Import query functions from `@/lib/database/queries`
- [ ] Replace all `supabase.from()` calls
- [ ] Remove unused Supabase imports (keep auth)
- [ ] Test the functionality
- [ ] Check for TypeScript errors
- [ ] Verify error handling
- [ ] Update tests if any
- [ ] Document any custom queries

## Support

- **Migration Guide:** `docs/DATABASE_MIGRATION.md`
- **Status:** `MIGRATION_STATUS.md`
- **PostgreSQL Setup:** `docs/POSTGRESQL_REMOTE_SETUP.md`
- **SSL Setup:** `docs/POSTGRESQL_SSL_SETUP.md`

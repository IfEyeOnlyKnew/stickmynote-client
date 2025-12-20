# 📚 Database Migration - Documentation Index

## 🎯 Start Here

1. **[MIGRATION_SUMMARY.md](./MIGRATION_SUMMARY.md)** - Overview of what was done
2. **[QUICK_REFERENCE.md](./QUICK_REFERENCE.md)** - Code examples and patterns
3. **[MIGRATION_STATUS.md](./MIGRATION_STATUS.md)** - Track progress

## 📖 Detailed Guides

### Migration
- **[DATABASE_MIGRATION.md](./docs/DATABASE_MIGRATION.md)** - Complete migration guide
  - Migration strategy
  - How to migrate a file
  - Common patterns
  - Rollback plan

### PostgreSQL Setup
- **[POSTGRESQL_REMOTE_SETUP.md](./docs/POSTGRESQL_REMOTE_SETUP.md)** - Remote database setup
  - Environment configuration
  - Security checklist
  - Troubleshooting
  
- **[POSTGRESQL_SSL_SETUP.md](./docs/POSTGRESQL_SSL_SETUP.md)** - SSL certificate setup
  - OpenSSL commands
  - Certificate installation
  - Common issues

## 🔧 Tools & Scripts

### Command Line Tools
```bash
# Test database connection (6 tests)
pnpm test:db

# Export database schema to JSON
pnpm export:schema

# Run SQL queries
pnpm sql:run "SELECT COUNT(*) FROM users"

# Test migration status
./scripts/test-migration.ps1

# Start development
pnpm dev
```

### Script Files
- `scripts/test-db-connection.ts` - Connection testing
- `scripts/export-schema.ts` - Schema export
- `scripts/run-sql.ts` - SQL execution
- `scripts/test-migration.ps1` - Migration verification

## 💻 Code Files

### Core Database Layer
- **`lib/database/pg-client.ts`** - PostgreSQL connection pool
  - Singleton pattern
  - SSL support
  - Connection pooling (max 20)
  - Transaction support
  - Health check

- **`lib/database/queries.ts`** - Query functions library
  - 40+ typed functions
  - Users, Notes, Replies, Tabs
  - Organizations, AI Sessions
  - Preferences, Search, Rate Limiting
  - Transactions

### Migrated Files
- ✅ `app/api/ai/ask/route.ts` - AI endpoint
- ✅ `contexts/user-context.tsx` - User profile
- ✅ `hooks/use-settings.ts` - Settings management

## 📊 Status & Progress

### Migration Statistics
- **Query Functions Created:** 40+
- **Files Migrated:** 3 / ~23
- **Completion:** ~15%
- **Database Tables:** 84
- **Database Size:** 14MB

### What's Working
- ✅ Database connection with SSL
- ✅ User authentication (Supabase)
- ✅ User profile fetching (PostgreSQL)
- ✅ AI question answering (PostgreSQL)
- ✅ Settings management (PostgreSQL)
- ✅ Transaction support
- ✅ Query logging

### What's Next
High priority files to migrate:
- `hooks/useNotesData.ts` (18 queries)
- `contexts/organization-context.tsx` (5 queries)
- `lib/notes.ts` (23 queries)

## 🚀 Quick Start

### For Development
```bash
# 1. Verify database connection
pnpm test:db

# 2. Start dev server
pnpm dev

# 3. Test these features:
#    - Sign in (Supabase Auth)
#    - View profile (PostgreSQL)
#    - Update settings (PostgreSQL)
#    - Ask AI question (PostgreSQL)
```

### For Migration Work
```bash
# 1. Read the quick reference
cat QUICK_REFERENCE.md

# 2. Pick a file to migrate from MIGRATION_STATUS.md

# 3. Follow pattern:
#    - Import query functions
#    - Replace supabase.from() calls
#    - Keep supabase.auth.* calls
#    - Test

# 4. Update MIGRATION_STATUS.md when done
```

## 📝 Common Tasks

### Check Database Schema
```bash
pnpm export:schema
# Creates: database-schema.json
```

### Test a Query
```bash
pnpm sql:run "SELECT * FROM users LIMIT 5"
```

### Add New Query Function
1. Edit `lib/database/queries.ts`
2. Define interface
3. Create query function
4. Import and use

Example:
```typescript
export interface MyTable extends QueryResultRow {
  id: string
  name: string
}

export async function getMyData(id: string): Promise<MyTable | null> {
  return queryOne<MyTable>("SELECT * FROM my_table WHERE id = $1", [id])
}
```

### Migrate a File
1. Open file with Supabase queries
2. Import from `@/lib/database/queries`
3. Replace `supabase.from()` with query functions
4. Keep `supabase.auth.*` unchanged
5. Test thoroughly
6. Mark complete in MIGRATION_STATUS.md

## 🔍 Finding Information

### "How do I..."
- **...connect to the database?** → Already configured in `lib/database/pg-client.ts`
- **...write a query?** → See `QUICK_REFERENCE.md` examples
- **...handle errors?** → Errors are thrown automatically, use try/catch
- **...use transactions?** → Use `db.transaction()` or `createStickWithTabs()`
- **...add auth?** → Keep using Supabase (`supabase.auth.*`)

### "What if..."
- **...I get a connection error?** → Check `docs/POSTGRESQL_REMOTE_SETUP.md`
- **...I get an SSL error?** → Check `docs/POSTGRESQL_SSL_SETUP.md`
- **...I need a custom query?** → Use `queryOne()`, `queryMany()`, or `execute()`
- **...the table doesn't exist?** → Run `pnpm export:schema` to verify
- **...I want to rollback?** → See rollback section in `docs/DATABASE_MIGRATION.md`

### "Where is..."
- **...the connection pool?** → `lib/database/pg-client.ts`
- **...the query functions?** → `lib/database/queries.ts`
- **...the migration status?** → `MIGRATION_STATUS.md`
- **...code examples?** → `QUICK_REFERENCE.md`
- **...the database schema?** → Run `pnpm export:schema`
- **...environment variables?** → `.env.local` (not in git)

## 🎓 Learning Resources

### Understanding the Migration
1. Read `MIGRATION_SUMMARY.md` - high-level overview
2. Read `docs/DATABASE_MIGRATION.md` - detailed guide
3. Review migrated files as examples
4. Check `QUICK_REFERENCE.md` for patterns

### Code Patterns
- **Before/After examples** → `QUICK_REFERENCE.md`
- **Query function usage** → Migrated files
- **Transaction examples** → `lib/database/queries.ts`
- **Error handling** → All query functions

## 🔐 Security

### SQL Injection Prevention
- ✅ Always use parameterized queries (`$1`, `$2`)
- ❌ Never concatenate user input into SQL
- ✅ All query functions use proper escaping

### Authentication
- ✅ Supabase Auth for authentication
- ✅ PostgreSQL for data access
- ✅ Verify user ownership in queries
- ✅ Use transactions for data integrity

### Connection Security
- ✅ SSL encryption enabled
- ✅ Self-signed certificate (development)
- ✅ Connection pooling
- ✅ Credentials in environment variables

## 📞 Support

### Documentation Files
- Main guide: `docs/DATABASE_MIGRATION.md`
- Quick reference: `QUICK_REFERENCE.md`
- Status tracker: `MIGRATION_STATUS.md`
- Summary: `MIGRATION_SUMMARY.md`

### Database Info
- Server: HOL-DC3-PGSQL.stickmynote.com:5432
- Database: stickmynote
- Version: PostgreSQL 15.15
- Tables: 84
- Size: 14MB

### Testing
```bash
# Full test suite
./scripts/test-migration.ps1

# Individual tests
pnpm test:db           # Connection
pnpm export:schema     # Schema
pnpm sql:run "..."     # Query
```

---

## 📁 File Structure

```
stickmynote-client-install/
│
├── 📋 MIGRATION_SUMMARY.md      ← Start here (overview)
├── 📖 QUICK_REFERENCE.md        ← Code examples
├── 📊 MIGRATION_STATUS.md       ← Progress tracker
├── 📚 MIGRATION_INDEX.md        ← This file
│
├── docs/
│   ├── DATABASE_MIGRATION.md   ← Complete guide
│   ├── POSTGRESQL_REMOTE_SETUP.md
│   └── POSTGRESQL_SSL_SETUP.md
│
├── lib/
│   └── database/
│       ├── pg-client.ts         ← Connection pool
│       └── queries.ts           ← Query functions
│
├── scripts/
│   ├── test-db-connection.ts
│   ├── export-schema.ts
│   ├── run-sql.ts
│   └── test-migration.ps1
│
└── [migrated files]
    ├── app/api/ai/ask/route.ts
    ├── contexts/user-context.tsx
    └── hooks/use-settings.ts
```

---

**🎯 Quick Navigation:** [Summary](./MIGRATION_SUMMARY.md) | [Reference](./QUICK_REFERENCE.md) | [Status](./MIGRATION_STATUS.md) | [Guide](./docs/DATABASE_MIGRATION.md)

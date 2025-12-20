# StickMyNote Client

A Next.js application with PostgreSQL database and Supabase authentication.

## 🚀 Quick Start

```bash
# Install dependencies
pnpm install

# Test database connection
pnpm test:db

# Start development server
pnpm dev
```

## 📊 Database

### Connection
- **Type:** PostgreSQL 15.15
- **Server:** HOL-DC3-PGSQL.stickmynote.com:5432
- **Database:** stickmynote (84 tables, 14MB)
- **SSL:** Enabled with self-signed certificate
- **Auth:** Hybrid - Supabase Auth + PostgreSQL Data

### Tools
```bash
pnpm test:db         # Test connection (6 tests)
pnpm export:schema   # Export schema to JSON
pnpm sql:run "..."   # Run SQL query
```

## 📚 Documentation

**Start Here:**
- **[MIGRATION_INDEX.md](./MIGRATION_INDEX.md)** - Complete documentation index
- **[MIGRATION_SUMMARY.md](./MIGRATION_SUMMARY.md)** - What was done
- **[QUICK_REFERENCE.md](./QUICK_REFERENCE.md)** - Code examples

**Guides:**
- **[docs/DATABASE_MIGRATION.md](./docs/DATABASE_MIGRATION.md)** - Migration guide
- **[MIGRATION_STATUS.md](./MIGRATION_STATUS.md)** - Progress tracker
- **[docs/POSTGRESQL_REMOTE_SETUP.md](./docs/POSTGRESQL_REMOTE_SETUP.md)** - Database setup
- **[docs/POSTGRESQL_SSL_SETUP.md](./docs/POSTGRESQL_SSL_SETUP.md)** - SSL configuration

## 🔧 Development

### Environment Setup

Create `.env.local`:

```bash
# PostgreSQL Connection
POSTGRES_HOST=HOL-DC3-PGSQL.stickmynote.com
POSTGRES_PORT=5432
POSTGRES_DATABASE=stickmynote
POSTGRES_USER=stickmynote_user
POSTGRES_PASSWORD=your_password
POSTGRES_SSL=true
POSTGRES_SSL_REJECT_UNAUTHORIZED=false

# Supabase Auth
NEXT_PUBLIC_SUPABASE_URL=your_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key
SUPABASE_SERVICE_ROLE_KEY=your_service_key
```

### Database Queries

```typescript
import { 
  getUserById, 
  getPersonalSticks, 
  createPersonalStick 
} from "@/lib/database/queries"

// Get user
const user = await getUserById(userId)

// Get notes
const notes = await getPersonalSticks(userId)

// Create note
const note = await createPersonalStick({
  user_id: userId,
  title: "My Note",
  content: "Content here"
})
```

See [QUICK_REFERENCE.md](./QUICK_REFERENCE.md) for more examples.

### Authentication

Authentication uses Supabase:

```typescript
import { createClient } from "@/lib/supabase/server"

const supabase = await createClient()

// Get user
const { data: { user } } = await supabase.auth.getUser()

// Sign out
await supabase.auth.signOut()
```

## 🏗️ Architecture

- **Frontend:** Next.js 14 with App Router
- **Database:** PostgreSQL 15.15 (direct connection)
- **Auth:** Supabase Auth
- **Styling:** Tailwind CSS
- **Type Safety:** TypeScript
- **Connection:** Node.js `pg` driver with pooling

### Database Layer

- **`lib/database/pg-client.ts`** - Connection pool (singleton)
- **`lib/database/queries.ts`** - 40+ typed query functions
- **Scripts:** Connection testing, schema export, SQL runner

## 📦 Available Scripts

```bash
# Development
pnpm dev              # Start dev server
pnpm build            # Build for production
pnpm start            # Start production server

# Database Tools
pnpm test:db          # Test database connection
pnpm export:schema    # Export database schema
pnpm sql:run "..."    # Execute SQL query

# Code Quality
pnpm lint             # Run linter
pnpm type-check       # TypeScript check
```

## 🔐 Security

- ✅ SSL encryption on all database connections
- ✅ Parameterized queries (SQL injection prevention)
- ✅ Environment variables for credentials
- ✅ Connection pooling (max 20 connections)
- ✅ Transaction support for data integrity

## 📈 Migration Status

**Completed:**
- PostgreSQL connection with SSL
- 40+ query functions
- 3 files migrated
- Complete documentation

**In Progress:**
- ~20 files remaining to migrate
- See [MIGRATION_STATUS.md](./MIGRATION_STATUS.md)

## 🤝 Contributing

1. Pick a file from [MIGRATION_STATUS.md](./MIGRATION_STATUS.md)
2. Follow patterns in [QUICK_REFERENCE.md](./QUICK_REFERENCE.md)
3. Test with `pnpm test:db` and `pnpm dev`
4. Update [MIGRATION_STATUS.md](./MIGRATION_STATUS.md)

## 📞 Support

- **Documentation Index:** [MIGRATION_INDEX.md](./MIGRATION_INDEX.md)
- **Quick Reference:** [QUICK_REFERENCE.md](./QUICK_REFERENCE.md)
- **Migration Guide:** [docs/DATABASE_MIGRATION.md](./docs/DATABASE_MIGRATION.md)
- **Database Setup:** [docs/POSTGRESQL_REMOTE_SETUP.md](./docs/POSTGRESQL_REMOTE_SETUP.md)

## 🎯 Tech Stack

- **Framework:** Next.js 14
- **Language:** TypeScript
- **Database:** PostgreSQL 15.15
- **Auth:** Supabase Auth
- **Styling:** Tailwind CSS
- **State:** React Context
- **Database Driver:** node-postgres (pg)
- **Deployment:** Vercel / Self-hosted

---

**Repository:** https://github.com/IfEyeOnlyKnew/stickmynote-client  
**Database:** PostgreSQL on HOL-DC3-PGSQL.stickmynote.com  
**Status:** ✅ Operational (Hybrid Migration)

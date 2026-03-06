# Codebase Cleanup Policy

Rules and checklists for keeping the codebase tidy as features are added, moved, or deprecated.

## 1. Route Migrations

When moving a page from one route to another:

- **Old route → redirect**: Replace the old `page.tsx` with a server-side `redirect()` to the new route
- **New route → standalone**: The new page must be self-contained (not re-exporting from the old route)
- **Wait period**: Keep redirects for at least 2 deploy cycles, then delete the old route folder
- **Update all references**: Search for `href="/old-route"` and `router.push("/old-route")` across components

### Current Redirects (created 2026-03-06)

| Old Route | New Route | Safe to Delete After |
|-----------|-----------|---------------------|
| `/calsticks/budget` | `/pm/budget` | 2026-04-01 |
| `/calsticks/portfolio` | `/pm/portfolio` | 2026-04-01 |
| `/calsticks/timesheets` | `/pm/timesheets` | 2026-04-01 |
| `/calsticks/invoices` | `/pm/invoices` | 2026-04-01 |
| `/calsticks/intake-forms` | `/pm/forms` | 2026-04-01 |

## 2. File Hygiene

### Never Commit
- `debug.log`, `*.log` files in source directories
- `.env`, `.env.local`, `.env.production` (already in .gitignore)
- `node_modules/`, `.next/`, `uploads/`
- `*.backup`, `*.bak`, `*.old`, `*.tmp` files

### Check Before Each Commit
```bash
# Find stale files
git status --short | grep "??"

# Find debug logs in source
find app/ components/ lib/ -name "*.log" -o -name "debug.*"

# Find backup files
find . -name "*.backup" -o -name "*.bak" -o -name "*.old" | grep -v node_modules | grep -v .next
```

## 3. API Route Versioning

The codebase has parallel `app/api/` (v1) and `app/api/v2/` routes.

### Rules
- **New features**: Create in `app/api/` only (v1). Do not create v2 versions unless there's a breaking change
- **v2 routes**: These exist for specific reasons (raw SQL vs Supabase adapter, different auth patterns). Do not duplicate new v1 routes into v2
- **Deprecation**: When a v2 route is no longer used by any client, delete it

### Known Duplicates (acceptable)
- `time-entries` — v1 uses Supabase adapter, v2 uses raw SQL with JOINs for richer data
- `pad-templates` — v1 and v2 have identical behavior (consolidate eventually)

## 4. Component Organization

| Directory | Purpose |
|-----------|---------|
| `components/calsticks/` | CalSticks task board components (Kanban, Gantt, ListView, etc.) |
| `components/pm/` | PM Hub layout and shared components (sidebar) |
| `components/ui/` | Shadcn UI primitives (do not add business logic here) |
| `components/social/` | Social Hub components |
| `components/shared/` | Cross-hub reusable components |

### Rules
- Page-specific logic stays in the page file, not extracted into a component unless reused
- Components should be imported by at least 2 files, otherwise inline the logic
- Dialog-based CRUD (like OKRManager) should have a full-page equivalent in the PM Hub

## 5. Import Cleanup

After moving/deleting features, check for:
- Unused icon imports in lucide-react (tree-shaking helps, but clean imports are clearer)
- Unused component imports
- Dead re-exports

```bash
# Find potentially unused imports (manual review needed)
grep -rn "import.*from" app/calsticks/page-client.tsx | head -20
```

## 6. Database Migrations

- Migration files in `scripts/windows-server/` are numbered sequentially (01, 02, ... 43, etc.)
- Each migration must be **idempotent** (safe to re-run): use `IF NOT EXISTS`, `DO $$ ... END $$`
- Never wrap in `BEGIN/COMMIT` — use independent statements so partial failures don't block the rest
- Table name convention: check existing tables before creating (e.g., `time_entries` not `paks_time_entries`)

## 7. Documentation

- `CLAUDE.md` — Deployment workflow and critical rules (keep concise)
- `docs/WhatToDo.txt` — Feature roadmap (update status when features ship)
- `docs/production-exclude-list.md` — Files never overwritten in production
- `docs/cleanup-policy.md` — This file

### Update Triggers
- Feature shipped → Update WhatToDo.txt status
- Route moved → Update this file's redirect table
- New migration → Add to migration list
- Architecture change → Update CLAUDE.md if it affects deployment

## 8. Pre-Commit Checklist

Before committing a feature branch:

- [ ] `pnpm run build` passes
- [ ] No `debug.log` or temp files staged
- [ ] No hardcoded localhost URLs (use relative paths)
- [ ] No `console.log` debug statements left in (use `console.error` for error logging only)
- [ ] Unused imports removed
- [ ] Old routes have redirects if moved
- [ ] WhatToDo.txt updated if feature status changed
- [ ] Migration file is idempotent

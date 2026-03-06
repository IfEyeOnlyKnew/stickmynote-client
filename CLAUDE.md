# CLAUDE.md - Production Update Workflow

This document provides instructions for updating the production folder and GitHub repositories.

## Repository Locations

| Environment | Local Path | GitHub Remote |
|-------------|------------|---------------|
| Development | `C:\stick-my-note-dev\stickmynote-client-install` | origin/main |
| Production | `C:\stick-my-note-prod\stickmynote-client` | origin/main |

## Critical: Files to NEVER Overwrite in Production

See [docs/production-exclude-list.md](docs/production-exclude-list.md) for full details.

| File/Folder | Reason |
|-------------|--------|
| `server.js` | **CRITICAL** - Production uses HTTPS (port 443), dev uses HTTP (port 80) |
| `.env` | Production environment variables |
| `.env.local` | Local environment overrides |
| `.env.production` | Production-specific settings |
| `.env.local.build-only` | Build-time environment |
| `certs/` | SSL certificates for HTTPS |
| `.next/` | Built files (rebuilt after update) |
| `node_modules/` | Dependencies |
| `uploads/` | **CRITICAL** - User-uploaded images and files (outside git repo, never wiped by deploys) |

## Workflow: Update Production from Development

### Step 1: Commit and Push Development Changes

```bash
# In development folder
cd C:\stick-my-note-dev\stickmynote-client-install

# Check status
git status

# Stage and commit changes
git add .
git commit -m "Updated Chat Icon"

# Push to GitHub
git push origin main

```

### Step 2: Update Production (Selective Checkout - RECOMMENDED)

# Navigate to production
cd C:\stick-my-note-prod\stickmynote-client

# Stop service and kill node processes first
net stop StickyMyNote
taskkill /F /IM node.exe

# Delete old build folder
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue

# Backup protected files
cp server.js server.js.backup
cp .env .env.backup
cp .env.production .env.production.backup

# Fetch latest without merging
git fetch origin main

# Selectively update directories (NEVER include server.js or .env files)
git checkout origin/main -- app/
git checkout origin/main -- components/
git checkout origin/main -- lib/
git checkout origin/main -- hooks/
git checkout origin/main -- types/
git checkout origin/main -- public/
git checkout origin/main -- styles/
git checkout origin/main -- package.json
git checkout origin/main -- pnpm-lock.yaml
git checkout origin/main -- next.config.mjs
git checkout origin/main -- tailwind.config.ts
git checkout origin/main -- tsconfig.json
git checkout origin/main -- docs/
git checkout origin/main -- .gitignore


### Step 3: Install Dependencies (if package.json changed)


pnpm install


### Step 4: Build Production


# Use build-only env for build phase
cp .env.local.build-only .env.local

# Build
pnpm run build

# CRITICAL: Remove build-only env after build (prevents empty POSTGRES_PASSWORD)
rm .env.local


> **WARNING:** You MUST delete `.env.local` after the build completes. Production does NOT need `.env.local` - it uses `.env` and `.env.production` which have the correct database credentials. If `.env.local` remains, sign-in will fail with "SASL: client password must be a string" because the build-time config has an empty `POSTGRES_PASSWORD`.

### Step 5: Start Service

# Requires admin privileges
net start StickyMyNote


### Step 6: Verify Production

1. Check `server.js` is HTTPS version: `findstr "require(\"https\")" server.js`
2. Test site loads: https://stickmynote.com
3. **Test sign-in works** (catches database connection issues)
4. Verify port 443: `netstat -an | findstr :443`
5. Check DNS: `nslookup stickmynote.com` should return `192.168.50.20`

## Quick Reference Commands

### Development (commit and push)
```bash
cd C:\stick-my-note-dev\stickmynote-client-install
git add . && git commit -m "message" && git push origin main
```

### Production (safe update)
```bash
cd C:\stick-my-note-prod\stickmynote-client
git fetch origin main
git checkout origin/main -- app/ components/ lib/ hooks/ types/ public/ styles/ .gitignore
pnpm run build
net stop StickyMyNote && net start StickyMyNote
```

> **Note:** Uploads are stored in `uploads/` (outside `public/`), so `git checkout public/` no longer wipes user files.

## Network Architecture

| Server | IP Address | Role |
|--------|------------|------|
| WIN-R0HEEUG88NH | 192.168.50.11 | Domain Controller, DNS Server |
| HOL-DC2-IIS | 192.168.50.20 | Application Server (StickyMyNote) |
| HOL-DC3-PGSQL | 192.168.50.30 | PostgreSQL Database Server |
| HOL-DC5-REDIS | 192.168.50.50 | Memcached Server |
| HOL-DC6-LIVE | 192.168.50.80 | LiveKit Video Server (Caddy TLS on :7443) |
| HOL-OLLAMA | 192.168.50.70 | Ollama AI Server |

## Troubleshooting

### CSRF Error / IIS 404
- Check DNS resolution: `nslookup stickmynote.com` should return `192.168.50.20`
- If it returns `192.168.50.11`, fix DNS on domain controller

### Build Fails with ECONNRESET
- Ensure ldapjs is externalized in `next.config.mjs`
- Use `.env.local.build-only` with `BUILDING=true` during build

### Site Down After Update
- Verify `server.js` wasn't overwritten: check for `require("https")`
- Restore from backup: `cp server.js.backup server.js`
- Restart service: `net stop StickyMyNote && net start StickyMyNote`

### Sign-in Returns 500 Error (SSL/TLS Issue)
- **Cause:** Node.js v24 has stricter TLS. Internal `fetch()` calls to HTTPS endpoints fail.
- **Fix:** API routes must NOT use `fetch()` to call other API routes internally.
- **Example:** `signin/route.ts` must use `checkLockout()` directly, not `fetch('/api/auth/check-lockout')`

## Code Patterns to Avoid

### Never Use Internal fetch() for API-to-API Calls

Production runs Node.js v24 with stricter TLS. Self-referential HTTPS fetch calls will fail.

**BAD - Will fail in production:**
```typescript
// DON'T DO THIS
const response = await fetch(`${request.nextUrl.origin}/api/auth/check-lockout`, {
  method: "POST",
  body: JSON.stringify({ email }),
})
```

**GOOD - Direct function call:**
```typescript
// DO THIS
import { checkLockout } from "@/lib/auth/lockout"
const lockoutData = await checkLockout(email)
```

**Files that must use direct calls (not fetch):**
- `app/api/auth/signin/route.ts` - uses `checkLockout()` and `recordLoginAttempt()`
- Any API route calling another API route internally

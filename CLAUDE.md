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

## Workflow: Update Production from Development

### Step 1: Commit and Push Development Changes

```bash
# In development folder
cd C:\stick-my-note-dev\stickmynote-client-install

# Check status
git status

# Stage and commit changes
git add .
git commit -m "Your commit message"

# Push to GitHub
git push origin main
```

### Step 2: Update Production (Selective Checkout - RECOMMENDED)

```bash
# Navigate to production
cd C:\stick-my-note-prod\stickmynote-client

# Backup protected files FIRST
cp server.js server.js.backup
cp .env .env.backup
cp .env.local .env.local.backup
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
```

### Step 3: Install Dependencies (if package.json changed)

```bash
pnpm install
```

### Step 4: Build Production

```bash
# Use build-only env for build phase
cp .env.local.build-only .env.local

# Build
pnpm run build

# Remove build-only env after build
rm .env.local

# Restore production env if it was backed up
cp .env.local.backup .env.local
```

### Step 5: Restart Service

```bash
# Requires admin privileges
nssm restart StickyMyNote
```

### Step 6: Verify Production

1. Check `server.js` is HTTPS version: `findstr "require(\"https\")" server.js`
2. Test site loads: https://stickmynote.com
3. Verify port 443: `netstat -an | findstr :443`
4. Check DNS: `nslookup stickmynote.com` should return `192.168.50.20`

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
git checkout origin/main -- app/ components/ lib/ hooks/ types/ public/
pnpm run build
nssm restart StickyMyNote
```

## Network Architecture

| Server | IP Address | Role |
|--------|------------|------|
| WIN-R0HEEUG88NH | 192.168.50.11 | Domain Controller, DNS Server |
| HOL-DC2-IIS | 192.168.50.20 | Application Server (StickyMyNote) |
| HOL-DC3-PGSQL | 192.168.50.30 | PostgreSQL Database Server |
| HOL-DC5-REDIS | 192.168.50.50 | Redis Cache Server |
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
- Restart service: `nssm restart StickyMyNote`

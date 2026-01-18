
# Push to Production Guide

Quick reference for deploying changes from development to production.

## Prerequisites

- Development changes committed and pushed to GitHub
- Admin access to production server (HOL-DC2-IIS / 192.168.50.20)

---

## Quick Deploy (Copy & Paste)

### Step 1: Push Development Changes

Run in **development** folder (`C:\stick-my-note-dev\stickmynote-client-install`):

```powershell
git add .
git commit -m "Your commit message"
git push origin main
```

### Step 2: Update Production

Run in **production** folder (`C:\stick-my-note-prod\stickmynote-client`):

```powershell
# Stop service and kill any hanging node processes
net stop StickyMyNote
taskkill /F /IM node.exe

# Fetch latest from GitHub
git fetch dev main

# Selectively checkout updated files (NEVER checkout server.js or .env files)
git checkout dev/main -- app/ components/ lib/ hooks/ types/ public/ styles/ docs/
git checkout dev/main -- package.json pnpm-lock.yaml next.config.mjs tailwind.config.ts tsconfig.json

# Install dependencies (if package.json changed)
pnpm install

# Set up build environment
Copy-Item .env.local.build-only .env.local -Force

# Clean old build and rebuild
Remove-Item -Recurse -Force .next
pnpm run build

# CRITICAL: Remove build-time env after build
Remove-Item .env.local

# Verify server.js is HTTPS version (should show output)
findstr "https" server.js

# Start service
net start StickyMyNote
```

---

## Post-Deployment Verification

```powershell
# Check service is running
Get-Service StickyMyNote

# Check port 443 is listening
netstat -an | findstr :443

# Check DNS resolves correctly (should return 192.168.50.20)
nslookup stickmynote.com
```

Then manually verify:
1. https://stickmynote.com loads
2. Sign-in works
3. New features function correctly

---

## Troubleshooting

### Build Hangs
```powershell
taskkill /F /IM node.exe
Remove-Item -Recurse -Force .next
pnpm run build
```

### "Web server is down" after deployment
Server.js was likely overwritten. Check and restore:
```powershell
findstr "https" server.js
# If no output, restore HTTPS version:
Copy-Item server.js.backup server.js -Force
net start StickyMyNote
```

### Sign-in returns 500 error
The `.env.local` file may still have build-time config:
```powershell
Remove-Item .env.local
Restart-Service StickyMyNote
```

### Service won't start
Check for errors:
```powershell
# Run manually to see errors
node server.js
```

---

## Files to NEVER Overwrite

| File | Reason |
|------|--------|
| `server.js` | Production uses HTTPS, dev uses HTTP |
| `.env` | Production database credentials |
| `.env.local` | Only use during build, then delete |
| `.env.production` | Production settings |
| `certs/` | SSL certificates |

---

## Network Reference

| Server | IP | Role |
|--------|-----|------|
| WIN-R0HEEUG88NH | 192.168.50.11 | Domain Controller, DNS |
| HOL-DC2-IIS | 192.168.50.20 | App Server (StickyMyNote) |
| HOL-DC3-PGSQL | 192.168.50.30 | PostgreSQL Database |
| HOL-DC5-REDIS | 192.168.50.50 | Redis Cache |
| HOL-OLLAMA | 192.168.50.70 | Ollama AI Server |

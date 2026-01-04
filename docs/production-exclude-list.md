# Production Exclude List

Files and folders that should **NOT** be overwritten when pulling updates to production.

These files contain environment-specific configurations that differ between dev and production.

> **CRITICAL:** The `server.js` file in production uses HTTPS with SSL certificates. The dev version uses HTTP only. **NEVER** overwrite `server.js` during deployment!

---

## Files to Preserve (Do Not Overwrite)

| File/Folder | Reason |
|-------------|--------|
| `server.js` | **CRITICAL** - Production uses HTTPS (port 443), dev uses HTTP (port 80) |
| `.env` | Production environment variables (database, API keys, secrets) |
| `.env.local` | Local environment overrides for production |
| `.env.production` | Production-specific environment settings |
| `.env.local.build-only` | Build-time environment for production |
| `certs/` | SSL certificates for production HTTPS (`server.crt`, `server.key`) |
| `.claude/settings.local.json` | Local Claude Code settings |
| `.next/` | Built files (will be rebuilt after pull) |
| `node_modules/` | Dependencies (will be reinstalled if needed) |

---

## Git Pull Strategy

When updating production, use these commands:

```bash
# Navigate to production folder
cd C:\stick-my-note-prod\stickmynote-client

# Backup ALL protected files BEFORE any git operations
cp server.js server.js.backup
cp .env .env.backup
cp .env.local .env.local.backup
cp .env.production .env.production.backup

# Pull latest changes (may fail if conflicts)
git pull origin main

# If pull fails due to conflicts, use selective checkout instead:
# git fetch origin
# git checkout origin/main -- <specific-files-to-update>

# Restore protected files
cp server.js.backup server.js
cp .env.backup .env
cp .env.local.backup .env.local
cp .env.production.backup .env.production

# Rebuild the application
pnpm run build

# Restart the service (requires admin)
nssm restart StickyMyNote
```

---

## SAFE Alternative: Selective File Updates

Instead of `git reset --hard` or full pulls, update specific files:

```bash
# Fetch latest without merging
git fetch origin main

# Checkout specific directories/files you want to update
git checkout origin/main -- app/
git checkout origin/main -- components/
git checkout origin/main -- lib/
git checkout origin/main -- hooks/
git checkout origin/main -- types/
# Add other directories as needed, but NEVER:
# git checkout origin/main -- server.js
# git checkout origin/main -- .env*
# git checkout origin/main -- certs/

# Rebuild
pnpm run build
```

---

## DANGEROUS: Git Reset (Use With Extreme Caution)

> **WARNING:** This approach caused a production outage on 2026-01-02 when `server.js` was overwritten.

```bash
# Backup protected files FIRST
cp server.js server.js.backup
cp .env .env.backup
cp .env.production .env.production.backup

# Reset to match remote (DESTROYS LOCAL CHANGES)
git fetch origin
git reset --hard origin/main

# IMMEDIATELY restore protected files
cp server.js.backup server.js
cp .env.backup .env
cp .env.production.backup .env.production

# Rebuild
pnpm run build
```

---

## Production Location

- **Path:** `C:\stick-my-note-prod\stickmynote-client`
- **Service Name:** `StickyMyNote` (Windows Service via nssm)

---

## Post-Update Checklist

1. [ ] Verify `server.js` is the HTTPS version (check for `require("https")` at top)
2. [ ] Verify `.env` files are intact
3. [ ] Verify `certs/` folder has SSL certificates (`server.crt`, `server.key`)
4. [ ] Run `pnpm run build` successfully
5. [ ] Restart the Windows service (nssm restart StickyMyNote)
6. [ ] Test https://stickmynotes.com loads correctly
7. [ ] Verify port 443 is listening: `netstat -an | findstr :443`

---

## Incident History

### 2026-01-02: Production Outage - HTTPS Configuration Lost

**What happened:**
- Ran `git reset --hard origin/main` on production server
- This overwrote the production `server.js` (HTTPS on port 443) with dev version (HTTP on port 80)
- Cloudflare "Full" SSL mode expects HTTPS on origin, so site went down

**Root cause:**
- Production `server.js` was not backed up before git reset
- Dev and production have different `server.js` configurations

**Resolution:**
1. Generated new self-signed SSL certificate:
   ```bash
   openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
     -keyout certs/server.key -out certs/server.crt \
     -subj "/CN=stickmynotes.com/O=StickyMyNote/C=US"
   ```
2. Created HTTPS-enabled `server.js` for production
3. Restarted StickyMyNote Windows service

**Prevention:**
- Added `server.js` to protected files list
- Updated deployment procedures to always backup before git operations
- Documented selective checkout method as safer alternative

---

## Production vs Dev Differences

| Component | Dev | Production |
|-----------|-----|------------|
| `server.js` | HTTP on port 80 | HTTPS on port 443 + HTTP redirect |
| SSL Certificates | None | `certs/server.crt`, `certs/server.key` |
| Cloudflare | Not used | "Full" SSL mode |
| Database | Local PostgreSQL | Production PostgreSQL |
| `.env` files | Dev credentials | Production credentials |

---

## Build-Time Configuration for LDAP

The production build requires special configuration to prevent ldapjs from attempting connections during the Next.js static page generation phase.

### Required next.config.mjs Settings

Ensure `next.config.mjs` includes these settings to externalize ldapjs:

```javascript
experimental: {
  instrumentationHook: true,
  // Prevent ldapjs from being bundled - will be loaded from node_modules at runtime only
  serverComponentsExternalPackages: ["ldapjs"],
},

// Also add to top-level serverExternalPackages for Next.js 14.2+
serverExternalPackages: ["ldapjs"],
```

And in the webpack configuration:

```javascript
if (isServer) {
  config.externals = config.externals || [];
  config.externals.push(
    "isomorphic-dompurify",
    // Externalize ldapjs to prevent it from being bundled and attempting connections during build
    "ldapjs"
  );
}
```

### Build-Time Guards

Files that use LDAP must have build-time guards to prevent connection attempts during `pnpm run build`:

- `lib/auth/ldap-auth.ts` - Uses `BUILDING` env var check
- `lib/api/config-check-helpers.ts` - `checkAD()` function has build-time guard

### Building for Production

When running builds, ensure you're NOT using `.env.local` with `BUILDING=true` in production runtime:

```bash
# For building only (use .env.local with BUILDING=true)
cp .env.local.build-only .env.local
pnpm run build

# After build, remove .env.local so production uses real config
rm .env.local

# Restart service
nssm restart StickyMyNote
```

### Incident History: 2026-01-04 - Build Failure (ECONNRESET)

**What happened:**
- Build failed with `ECONNRESET` during "Generating static pages" phase
- ldapjs was being loaded and attempting LDAP connection during build

**Root cause:**
- `/api/v2/config-check/route.ts` had a GET handler that called `checkAD()`
- During static generation, Next.js executed this route
- ldapjs attempted to connect to LDAP server (which rejected/reset the connection)

**Resolution:**
1. Added `export const dynamic = 'force-dynamic'` to `/api/v2/config-check/route.ts`
2. Added build-time guard to `checkAD()` function
3. Added `serverComponentsExternalPackages: ["ldapjs"]` to `next.config.mjs`
4. Added `ldapjs` to webpack externals

**Prevention:**
- All routes using LDAP must have `export const dynamic = 'force-dynamic'`
- All functions importing ldapjs must check `process.env.BUILDING` before import

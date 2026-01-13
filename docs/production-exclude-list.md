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
6. [ ] Test https://stickmynote.com loads correctly
7. [ ] Verify port 443 is listening: `netstat -an | findstr :443`
8. [ ] **Verify DNS resolution:** `nslookup stickmynote.com` should return `192.168.50.20`

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

---

### 2026-01-11: Production Outage - Internal DNS Misconfiguration (CSRF Error)

**What happened:**
- Users received "Invalid CSRF token" error when trying to sign in
- Site appeared to load but all API calls failed with 404 from IIS

**Symptoms:**
- `curl -k https://stickmynote.com/api/csrf` returned IIS 404 page
- Error message: `Server: Microsoft-IIS/10.0`

**Root cause:**
- Active Directory domain name is `stickmynote.com` (same as public website)
- This creates an internal DNS zone on the domain controller (192.168.50.11)
- The `@` A record in this zone pointed to `192.168.50.11` (the DC itself)
- Internal clients resolved `stickmynote.com` to the DC instead of the app server
- IIS on the DC responded with 404 for all Next.js routes

**How to diagnose:**
```powershell
# From any internal machine - check where DNS resolves
nslookup stickmynote.com              # Internal DNS result
nslookup stickmynote.com 8.8.8.8      # Public DNS result (should be Cloudflare IPs)

# If these differ, internal DNS is overriding Cloudflare
```

**Resolution:**
On domain controller (192.168.50.11):
```powershell
# Check the DNS zone records
Get-DnsServerResourceRecord -ZoneName "stickmynote.com" -RRType A

# Remove wrong A record
Remove-DnsServerResourceRecord -ZoneName "stickmynote.com" -Name "@" -RRType A -RecordData "192.168.50.11" -Force

# Add correct A record pointing to app server
Add-DnsServerResourceRecordA -ZoneName "stickmynote.com" -Name "@" -IPv4Address "192.168.50.20"
```

Then flush DNS on client machines:
```cmd
ipconfig /flushdns
```

**Prevention:**
- AD domain = public domain creates "split-brain DNS" - internal DNS zone overrides Cloudflare
- The `@` A record in the internal `stickmynote.com` zone **MUST** point to `192.168.50.20`
- Add DNS verification to post-update checklist
- If DNS issues suspected, always check: `nslookup stickmynote.com` vs `nslookup stickmynote.com 8.8.8.8`

---

## Network Architecture Reference

| Server | IP Address | Role |
|--------|------------|------|
| WIN-R0HEEUG88NH | 192.168.50.11 | Domain Controller, DNS Server |
| HOL-DC2-IIS | 192.168.50.20 | **Application Server (StickyMyNote)** |
| HOL-DC3-PGSQL | 192.168.50.30 | PostgreSQL Database Server |
| HOL-DC4-EXCH | 192.168.50.40 | Exchange Server |
| HOL-DC5-REDIS | 192.168.50.50 | Redis Cache Server |
| HOL-OLLAMA | 192.168.50.70 | Ollama AI Server |

---

## DNS Configuration (Critical)

Because the AD domain is `stickmynote.com`, the domain controller has an authoritative DNS zone that overrides external DNS for internal clients.

**Required DNS records in `stickmynote.com` zone on DC (192.168.50.11):**

| Name | Type | Value | Purpose |
|------|------|-------|---------|
| `@` | A | `192.168.50.20` | Root domain points to app server |
| `www` | A | `192.168.50.20` | WWW subdomain (if used) |

**Do NOT change these records (AD-managed):**
- `_msdcs`, `_gc._tcp`, `_kerberos.*`, `_ldap.*` - Active Directory service records
- `DomainDnsZones`, `ForestDnsZones` - AD replication zones

**Verification command:**
```powershell
Get-DnsServerResourceRecord -ZoneName "stickmynote.com" -Name "@" -RRType A
# Should show: 192.168.50.20
```

---

## Code Patterns to Avoid in Production

### Never Use Internal fetch() for API-to-API Calls

**Problem:** Node.js v24 has stricter TLS defaults. When server-side code calls itself via HTTPS (e.g., `fetch('https://stickmynote.com/api/...')`), it can fail with SSL errors like `ERR_SSL_PACKET_LENGTH_TOO_LONG`.

**Bad pattern:**
```typescript
// DON'T DO THIS - fails on Node v24 with self-signed certs
const response = await fetch(`${request.nextUrl.origin}/api/auth/check-lockout`, {
  method: "POST",
  body: JSON.stringify({ email }),
})
```

**Good pattern:**
```typescript
// DO THIS - direct function call, no HTTP overhead
import { checkLockout } from "@/lib/auth/lockout"
const lockoutData = await checkLockout(email)
```

**Affected files to check:**
- `app/api/auth/signin/route.ts` - Must use direct `checkLockout()` and `recordLoginAttempt()` calls
- Any API route that calls another API route internally

### 2026-01-13: Production Outage - Sign-in Failed (SSL/TLS Error)

**What happened:**
- Users could not sign in - received 500 Internal Server Error
- Console showed: `POST https://stickmynote.com/api/auth/check-lockout 500`

**Root cause:**
- `signin/route.ts` used `fetch()` to call `/api/auth/check-lockout` and `/api/auth/record-attempt`
- Node.js v24 has stricter TLS requirements
- Self-referential HTTPS fetch calls failed with `ERR_SSL_PACKET_LENGTH_TOO_LONG`

**Resolution:**
Changed `signin/route.ts` to use direct database function calls:
```typescript
// Before (broken):
const lockoutCheck = await fetch(`${request.nextUrl.origin}/api/auth/check-lockout`, {...})

// After (fixed):
import { checkLockout, recordLoginAttempt } from "@/lib/auth/lockout"
const lockoutData = await checkLockout(normalizedEmail)
```

**Prevention:**
- Never use `fetch()` for internal API-to-API calls
- Always use direct function imports for server-side operations
- Add this check to code review process

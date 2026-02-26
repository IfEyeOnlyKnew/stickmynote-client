# CDN Configuration Reference

This document outlines the configuration needed when deploying a CDN (e.g., Cloudflare) in front of the StickyMyNote application server.

## Current State (CDN-Ready)

The application is optimized for CDN deployment with proper cache headers on all asset types:

| Path | Cache-Control | Notes |
|------|---------------|-------|
| `/_next/static/*` | `public, max-age=31536000, immutable` | Content-hashed filenames, safe to cache forever |
| `/images/*` | `public, max-age=31536000, immutable` | Static brand assets |
| `/uploads/*` | `public, max-age=86400, stale-while-revalidate=604800` | User-uploaded content (avatars, branding) |
| `/exports/*` | `private, max-age=300, no-transform` | User-generated DOCX files, CDN must NOT cache |
| `/favicon.ico`, `/apple-icon.png`, `/icon*`, `/placeholder*` | `public, max-age=2592000` | 30-day TTL |
| `/manifest.json` | `public, max-age=3600, stale-while-revalidate=86400` | PWA manifest, 1-hour TTL |
| `/sw.js` | `public, max-age=0, must-revalidate` | Service worker, must never be cached |
| `/api/auth/*` | `no-store, no-cache, must-revalidate` | CDN must NEVER cache |
| `/api/sitemap`, `/api/robots` | `public, max-age=3600, stale-while-revalidate=86400` | Public SEO endpoints |
| `/api/*` (other) | `private, no-cache` | Authenticated API, CDN must NOT cache |
| HTML pages | Vary: Cookie, Authorization | CDN segments by auth, effectively bypassed |

## Cloudflare Configuration

### DNS Setup

- Add `A` record for `stickmynote.com` → `192.168.50.20` (proxied, orange cloud)
- Add `CNAME` record for `www` → `stickmynote.com` (proxied)

### SSL/TLS

- Mode: **Full (Strict)** — origin has valid SSL certificate
- Minimum TLS: 1.2
- Always Use HTTPS: ON
- HSTS: Already set by the application (`max-age=63072000; includeSubDomains; preload`)

### Cache Rules (in priority order)

1. **Bypass cache for WebSocket**
   - Match: URI path equals `/ws`
   - Action: Bypass cache, disable WebSocket compression (ws handles its own framing)

2. **Bypass cache for auth API**
   - Match: URI path starts with `/api/auth/`
   - Action: Bypass cache

3. **Bypass cache for all API**
   - Match: URI path starts with `/api/`
   - Action: Bypass cache (respect `Cache-Control: private`)

4. **Bypass cache for service worker**
   - Match: URI path equals `/sw.js`
   - Action: Bypass cache (always serve fresh)

5. **Cache static assets aggressively**
   - Match: URI path starts with `/_next/static/`
   - Action: Cache everything, Edge TTL = 1 year, Browser TTL = respect origin

6. **Cache images**
   - Match: URI path starts with `/images/` OR `/uploads/`
   - Action: Cache everything, Edge TTL = 1 day, Browser TTL = respect origin

7. **Cache public assets**
   - Match: URI path matches `favicon.ico|apple-icon.png|manifest.json|placeholder*`
   - Action: Cache everything, Edge TTL = 1 hour

### Compression

- Brotli: **ON** (Cloudflare handles Brotli automatically)
- After enabling Cloudflare: Set `compress: false` in `next.config.mjs` to avoid double-compression

### WebSocket Proxy

- Cloudflare proxies WebSocket connections automatically on Business/Enterprise plans
- Free plan: WebSocket is supported but verify `/ws` endpoint works through proxy
- The `Upgrade: websocket` header must be passed through

## Application Changes When Enabling CDN

### 1. `next.config.mjs`

```javascript
// Add CDN asset prefix if using a CDN subdomain for static assets
assetPrefix: process.env.CDN_URL || '',

// Disable Node.js compression (CDN handles it)
compress: false,

// Add CDN hostname to image domains if using Cloudflare Images
images: {
  domains: [...existingDomains, 'cdn.stickmynote.com'],
}
```

### 2. `lib/security-headers.ts`

Search for `CDN-READY` comments and make these changes:

```
style-src: Add CDN origin (e.g., https://cdn.stickmynote.com)
font-src:  Add CDN origin
img-src:   Add CDN origin
script-src: Add CDN origin (if serving JS from CDN subdomain)
Cross-Origin-Resource-Policy: Change from "same-site" to "cross-origin"
```

### 3. Environment Variable

Add to `.env.production`:

```
CDN_URL=https://cdn.stickmynote.com
```

## Monitoring

After CDN deployment, verify:

1. `curl -I https://stickmynote.com/_next/static/chunks/main.js` — should show `cf-cache-status: HIT`
2. `curl -I https://stickmynote.com/sw.js` — should show `cf-cache-status: BYPASS`
3. `curl -I https://stickmynote.com/api/auth/session` — should show `cf-cache-status: BYPASS`
4. WebSocket: `new WebSocket('wss://stickmynote.com/ws')` — should connect successfully
5. Login flow works end-to-end (auth cookies pass through CDN)
6. Fonts load correctly (check Network tab for `/_next/static/media/*.woff2`)

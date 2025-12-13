# Stick My Note Security Implementation

## Overview

This document outlines the security measures implemented in the Stick My Note application to protect user data, prevent common web vulnerabilities, and ensure secure multi-tenant operations.

---

## Authentication & Authorization

### Supabase Authentication
- **JWT-based authentication** with automatic token refresh via middleware
- Session validation on every protected route
- Secure cookie handling with HTTP-only cookies for auth tokens

### Role-Based Access Control (RBAC)
The application implements a hierarchical role system:

| Role | Permissions |
|------|-------------|
| `owner` | Full control over organization, can delete org, manage all members |
| `admin` | Can manage members, edit all content, cannot delete org |
| `member` | Can create and edit own content, view shared content |
| `viewer` | Read-only access to shared content |

### Hub Mode Restrictions
Users can be configured with different access levels:
- `full_access` - Access to all features including social hub
- `personal_only` - Limited to `/notes` and `/panel` routes only

### Organization Context
- `getOrgContext()` validates user membership in organizations
- Prevents cross-tenant data access
- Falls back to personal mode when no org membership exists

---

## Row Level Security (RLS)

All database tables are protected with Supabase RLS policies.

### Key Policies

\`\`\`sql
-- Helper function for efficient policy evaluation
CREATE OR REPLACE FUNCTION is_org_member(org_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM org_memberships
    WHERE org_memberships.org_id = $1
    AND org_memberships.user_id = auth.uid()
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;
\`\`\`

### Protected Tables
- `notes` - User can only access own notes or shared notes in their org
- `sticks` - Scoped to pad membership
- `replies` - Scoped to note/stick ownership or org membership
- `pads` - Owner-based with member access
- `organizations` - Member-only access
- `org_memberships` - Self-read, admin-write
- All social content tables (posts, comments, teams, etc.)

---

## CSRF Protection

### Implementation
- **HMAC-SHA256 signed tokens** with timestamp
- **24-hour expiration** for tokens
- **Edge Runtime compatible** using Web Crypto API

### Protected Endpoints
CSRF validation is applied to critical state-changing operations:

| Endpoint | Method | Protection |
|----------|--------|------------|
| `/api/auth/logout` | POST | CSRF required |
| `/api/delete-account` | DELETE | CSRF required |
| `/api/notes` | POST | CSRF required |
| `/api/notes/[id]` | DELETE | CSRF required |
| `/api/notes/[id]/replies` | POST/DELETE | CSRF required |
| `/api/avatar-upload` | POST | CSRF required |
| `/api/export-note` | POST | CSRF required |
| `/api/clear-all-users-complete` | DELETE | CSRF required |

### Token Flow
1. Client requests token from `/api/csrf` (GET)
2. Server generates signed token with timestamp
3. Token stored in cookie and returned in response
4. Client sends token in `x-csrf-token` header or cookie
5. Server validates signature and expiration

### Using CSRF Protection

\`\`\`typescript
import { withCSRFProtection } from "@/lib/csrf-middleware"

// Wrap your handler with CSRF protection
export const POST = withCSRFProtection(async (request) => {
  // Your handler logic - CSRF already validated
})
\`\`\`

---

## Input Validation

### Zod Schema Validation
All API inputs are validated using Zod schemas:

\`\`\`typescript
// Example: Note validation
const noteValidation = {
  topic: z.string().max(75),
  content: z.string().max(1000),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  // ...
}
\`\`\`

### Validation Rules
- **UUID validation** for all ID parameters
- **String length limits** enforced consistently
- **Type coercion** prevented (strict mode)
- **Hex color validation** for theme colors

---

## XSS Prevention

### DOMPurify Integration
Three sanitization levels available:

| Level | Use Case | Allowed Tags |
|-------|----------|--------------|
| `strict` | Plain text fields | None |
| `minimal` | Basic formatting | `b`, `i`, `em`, `strong`, `br` |
| `richText` | Rich content | Extended set with links |

### Blocked Protocols
- `javascript:`
- `data:` (for links)
- `vbscript:`

### API Middleware
\`\`\`typescript
sanitizeRequestBody(body, {
  topic: 'strict',
  content: 'minimal',
  // field-specific rules
})
\`\`\`

---

## Rate Limiting

### Action-Specific Limits

| Action | Limit | Window |
|--------|-------|--------|
| Auth attempts | 5 | 5 minutes |
| Note creation | 10 | 1 minute |
| AI features | 5-10 | 1 minute |
| Tag generation | 3 | 1 minute |
| Exports | 5 | 1 minute |

### Implementation
- **Redis-based** with Upstash for distributed limiting
- **In-memory fallback** when Redis unavailable
- **Fail-open** approach to prevent service disruption
- Per-user tracking with IP fallback for unauthenticated requests

---

## Security Headers

Applied via middleware to all responses:

\`\`\`typescript
const securityHeaders = {
  'Content-Security-Policy': "default-src 'self'; ...",
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
}
\`\`\`

---

## Environment Variables

All secrets are stored as Vercel environment variables:

| Variable | Purpose |
|----------|---------|
| `SUPABASE_SERVICE_ROLE_KEY` | Admin database access |
| `SUPABASE_JWT_SECRET` | JWT validation |
| `CSRF_SECRET` | CSRF token signing |
| `ENCRYPTION_MASTER_KEY` | Data encryption |
| `XAI_API_KEY` | AI service access |
| `BRAVE_API_KEY` | Search API access |

**Never** commit secrets to version control. All sensitive values are managed through Vercel's secure environment variable system.

---

## Secure Coding Practices

### Database Queries
- All queries use parameterized statements via Supabase client
- No raw SQL string concatenation
- RLS provides defense-in-depth

### Error Handling
- Generic error messages to clients
- Detailed logging server-side only
- No stack traces exposed in production

### Session Management
- Automatic token refresh in middleware
- Secure cookie attributes (HttpOnly, Secure, SameSite)
- Session invalidation on logout

---

## Multi-Tenant Security

### Data Isolation
- All queries scoped to user's organization
- Cross-tenant access prevented at RLS level
- Organization context validated on every request

### Membership Validation
\`\`\`typescript
const orgContext = await getOrgContext(supabase, userId, requestedOrgId)
if (!orgContext) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}
\`\`\`

---

## Audit & Monitoring

### Logging
- Authentication events logged
- Rate limit violations tracked
- CSRF failures logged with context

### Recommended Additions
- [ ] Security event alerting
- [ ] Anomaly detection for suspicious patterns
- [ ] Regular security audits

---

## Security Checklist for New Features

When adding new features, ensure:

- [ ] Input validation with Zod schemas
- [ ] XSS sanitization for user content
- [ ] CSRF protection for state-changing operations
- [ ] Rate limiting for resource-intensive operations
- [ ] RLS policies for new database tables
- [ ] Authorization checks in API routes
- [ ] Secrets stored in environment variables
- [ ] Error messages don't leak sensitive info

---

## Reporting Security Issues

If you discover a security vulnerability, please report it responsibly by contacting the development team directly rather than opening a public issue.

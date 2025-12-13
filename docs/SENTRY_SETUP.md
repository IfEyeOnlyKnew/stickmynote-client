# Sentry Error Tracking Setup

## Overview

This application uses Sentry for comprehensive error tracking, performance monitoring, and session replay across client, server, and edge runtimes.

## Environment Variables

### Required for Production

\`\`\`bash
# Sentry DSN (Data Source Name)
SENTRY_DSN=https://your-key@o123456.ingest.sentry.io/123456
NEXT_PUBLIC_SENTRY_DSN=https://your-key@o123456.ingest.sentry.io/123456

# Sentry Project Configuration (for source map uploads)
SENTRY_ORG=your-organization-slug
SENTRY_PROJECT=your-project-slug
SENTRY_AUTH_TOKEN=your-auth-token

# Automatic release tracking (set by Vercel)
VERCEL_GIT_COMMIT_SHA=auto-set-by-vercel
\`\`\`

### Getting Your Sentry Credentials

1. **Create a Sentry Account**: Sign up at https://sentry.io
2. **Create a Project**: Choose "Next.js" as the platform
3. **Get Your DSN**: Found in Project Settings → Client Keys (DSN)
4. **Create Auth Token**: User Settings → Auth Tokens → Create New Token
   - Scopes needed: `project:read`, `project:releases`, `org:read`
5. **Find Org/Project Slugs**: In your project URL: `sentry.io/organizations/{org-slug}/projects/{project-slug}/`

## Features Enabled

### Client-Side (Browser)
- **Error Tracking**: Captures JavaScript errors and unhandled promise rejections
- **Performance Monitoring**: Tracks page load times, API calls, and user interactions
- **Session Replay**: Records user sessions when errors occur (with privacy masking)
- **Breadcrumbs**: Tracks user actions leading up to errors

### Server-Side (Node.js)
- **API Error Tracking**: Captures errors in API routes and server components
- **Database Monitoring**: Tracks Prisma/Postgres query performance
- **Performance Profiling**: Identifies slow server-side operations
- **Request Context**: Captures request details (sanitized for security)

### Edge Runtime (Middleware)
- **Middleware Errors**: Tracks errors in Next.js middleware
- **Edge Function Performance**: Monitors edge function execution times
- **Lightweight Tracking**: Optimized for edge runtime constraints

## Release Tracking

Releases are automatically tracked using Git commit SHAs from Vercel deployments:

- **Development**: Release name is "development"
- **Production**: Release name is the Git commit SHA
- **Source Maps**: Automatically uploaded during production builds
- **Deploy Tracking**: Each deployment is associated with its environment

## Source Maps

Source maps are automatically:
1. Generated during production builds (`productionBrowserSourceMaps: true`)
2. Uploaded to Sentry via `@sentry/nextjs` webpack plugin
3. Hidden from public access (`hideSourceMaps: true`)
4. Used to provide readable stack traces in Sentry

## Sampling Rates

To control costs and data volume:

### Production
- **Error Tracking**: 100% of errors captured
- **Performance Traces**: 10% of transactions sampled
- **Session Replay**: 10% of normal sessions, 100% of error sessions
- **Profiling**: 10% of transactions profiled

### Development
- **Error Tracking**: 100% of errors captured
- **Performance Traces**: 100% of transactions sampled
- **Session Replay**: Disabled (0%)
- **Profiling**: 100% of transactions profiled

## Privacy & Security

### Data Sanitization
- **PII Masking**: All text and inputs masked in session replays
- **Sensitive Headers**: Authorization, cookies, and CSRF tokens removed
- **Query Parameters**: Tokens, keys, and passwords stripped from URLs
- **User IDs**: Only non-PII user IDs included for tracking

### Ignored Errors
The following errors are filtered out to reduce noise:
- Browser extension errors
- Network errors (handled by app)
- Expected auth errors (handled by app)
- Health check failures
- Rate limit errors (expected behavior)

## Monitoring & Alerts

### Recommended Alerts
1. **Error Rate Spike**: Alert when error rate exceeds 5% of requests
2. **Performance Degradation**: Alert when p95 response time > 2s
3. **High Memory Usage**: Alert when memory usage > 80%
4. **Failed Deployments**: Alert on release errors

### Dashboard Metrics
- Error frequency and trends
- Performance metrics (LCP, FID, CLS)
- User impact (affected users, sessions)
- Release health (crash-free rate)

## Troubleshooting

### Source Maps Not Working
1. Verify `SENTRY_AUTH_TOKEN` is set in Vercel
2. Check `SENTRY_ORG` and `SENTRY_PROJECT` match your Sentry project
3. Ensure build completes successfully
4. Check Sentry project settings → Source Maps

### No Errors Appearing
1. Verify `SENTRY_DSN` and `NEXT_PUBLIC_SENTRY_DSN` are set
2. Check browser console for Sentry initialization
3. Verify errors aren't in the `ignoreErrors` list
4. Check Sentry project quota hasn't been exceeded

### High Data Volume
1. Reduce `tracesSampleRate` in production
2. Reduce `replaysSessionSampleRate` in production
3. Add more errors to `ignoreErrors` list
4. Implement custom `beforeSend` filtering

## Testing Sentry Integration

### Test Error Tracking
\`\`\`javascript
// Trigger a test error
throw new Error("Sentry test error")
\`\`\`

### Test Performance Monitoring
\`\`\`javascript
// Check browser console for Sentry traces
console.log("Sentry initialized:", !!window.Sentry)
\`\`\`

### Verify Source Maps
1. Trigger an error in production
2. Check Sentry issue details
3. Verify stack trace shows original source code (not minified)

## Best Practices

1. **Always set release names** for better tracking
2. **Use breadcrumbs** to add context to errors
3. **Tag errors** with relevant metadata (user role, feature, etc.)
4. **Set user context** (without PII) for better debugging
5. **Monitor performance budgets** to catch regressions
6. **Review and triage errors** regularly
7. **Set up alerts** for critical issues
8. **Use Sentry's issue grouping** to reduce noise

## Cost Optimization

- Adjust sampling rates based on traffic volume
- Filter out noisy errors that don't require action
- Use Sentry's spike protection features
- Archive resolved issues to free up quota
- Consider upgrading plan if hitting limits frequently

## Support

- Sentry Documentation: https://docs.sentry.io/platforms/javascript/guides/nextjs/
- Sentry Support: https://sentry.io/support/
- Internal Team: Contact DevOps team for access and configuration

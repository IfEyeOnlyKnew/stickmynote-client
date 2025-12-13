# Caching & Edge Rendering Strategy

## Overview

This document outlines the caching and edge rendering strategy for the Stick My Note application to optimize performance and reduce database load.

## Caching Layers

### 1. **API Response Caching (Redis)**

All list endpoints use Redis-based caching with the following strategy:

- **Notes**: 30s TTL, 60s SWR
- **Pads**: 60s TTL, 300s SWR  
- **Sticks**: 30s TTL, 60s SWR
- **QuickSticks**: 30s TTL, 60s SWR
- **CalSticks**: 60s TTL, 300s SWR

### 2. **HTTP Cache Headers**

All cached responses include:
- `Cache-Control`: Public caching with s-maxage and stale-while-revalidate
- `ETag`: For conditional requests (304 Not Modified)
- `Last-Modified`: For cache validation
- `Vary`: Ensures proper cache keying by user

### 3. **Edge Runtime**

The following endpoints use Edge Runtime for faster response times:
- `/api/pads/browse-all` - List all pads
- `/api/quicksticks` - List quick sticks
- `/api/multipaks/browse-all` - List multi-paks

Edge runtime provides:
- Lower latency (deployed globally)
- Faster cold starts
- Better scalability

## Cache Invalidation

### Automatic Invalidation

Cache is automatically invalidated when:
- Creating a new note/pad/stick
- Updating existing data
- Deleting data

### Manual Invalidation

Use the `APICache.invalidate()` method:

\`\`\`typescript
// Invalidate all notes for a user
await APICache.invalidate(`notes:userId=${userId}`)

// Invalidate by tag
await APICache.invalidateByTags(['notes-user123'])
\`\`\`

## Cache Keys

Cache keys follow this pattern:
\`\`\`
api:{endpoint}:{param1}={value1}&{param2}={value2}
\`\`\`

Examples:
- `api:notes:userId=123&limit=20&offset=0&filter=all`
- `api:quicksticks:userId=123&search=meeting`

## Stale-While-Revalidate (SWR)

SWR allows serving stale content while fetching fresh data in the background:

1. Request comes in
2. If cache is fresh (< TTL), return cached data
3. If cache is stale but within SWR window:
   - Return stale data immediately
   - Fetch fresh data in background
   - Update cache for next request
4. If cache is expired (> SWR), fetch fresh data

## Performance Metrics

Expected improvements:
- **API Response Time**: 50-80% reduction for cached requests
- **Database Load**: 60-70% reduction
- **User Experience**: Instant page loads with SWR

## Monitoring

Monitor cache performance:
- Cache hit rate (target: >70%)
- Average response time
- Database query count
- Redis memory usage

## Best Practices

1. **Always invalidate cache** after mutations
2. **Use appropriate TTLs** based on data freshness requirements
3. **Include user ID** in cache keys for user-specific data
4. **Use edge runtime** for read-heavy endpoints
5. **Monitor cache hit rates** and adjust TTLs accordingly

## Configuration

Cache configuration is centralized in `/lib/api-cache.ts`:

\`\`\`typescript
const DEFAULT_TTL = 60 // 1 minute
const DEFAULT_SWR = 300 // 5 minutes
\`\`\`

Adjust these values based on your application's needs.

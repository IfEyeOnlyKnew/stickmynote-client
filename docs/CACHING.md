# Caching Strategy

This document outlines the caching strategy for the Stick My Note application using Next.js 15/16's built-in caching APIs.

## Overview

We use Next.js's `unstable_cache` API to cache Supabase queries at the data layer level. This provides:

- **Reduced database load**: Repeated queries are served from cache
- **Faster page loads**: Cached data is returned immediately
- **Granular invalidation**: Cache tags allow precise cache invalidation
- **Automatic revalidation**: Time-based revalidation keeps data fresh

## Cache Configuration

### Cache Durations

| Data Type | Duration | Reason |
|-----------|----------|--------|
| Notes | 60 seconds | Frequently updated by users |
| Note Stats | 5 minutes | Aggregated data, less critical |
| Pads | 5 minutes | Less frequently updated |
| Sticks | 60 seconds | Frequently updated |

### Cache Tags

Cache tags enable granular invalidation:

\`\`\`typescript
CACHE_TAGS = {
  notes: (userId: string) => `notes-${userId}`,
  noteStats: (userId: string) => `note-stats-${userId}`,
  pads: (userId: string) => `pads-${userId}`,
  sticks: (userId: string) => `sticks-${userId}`,
  pad: (padId: string) => `pad-${padId}`,
  stick: (stickId: string) => `stick-${stickId}`,
}
\`\`\`

## Usage

### Data Layer Functions

All data layer functions in `lib/data/` are automatically cached:

\`\`\`typescript
// Automatically cached for 60 seconds
const notes = await fetchUserNotes(userId)

// Automatically cached for 5 minutes
const pads = await fetchUserPads(userId)
\`\`\`

### Cache Invalidation

Invalidate cache after mutations in API routes:

\`\`\`typescript
import { invalidateNotesCache } from "@/lib/cache-config"

// In your API route after creating/updating/deleting a note
export async function POST(req: Request) {
  // ... create note logic ...
  
  // Invalidate the cache
  await invalidateNotesCache(userId)
  
  return NextResponse.json({ success: true })
}
\`\`\`

### Available Invalidation Functions

\`\`\`typescript
// Invalidate user's notes cache
await invalidateNotesCache(userId)

// Invalidate user's pads cache
await invalidatePadsCache(userId)

// Invalidate user's sticks cache
await invalidateSticksCache(userId)

// Invalidate specific pad cache
await invalidatePadCache(padId)

// Invalidate specific stick cache
await invalidateStickCache(stickId)
\`\`\`

## Best Practices

1. **Always invalidate after mutations**: Call invalidation functions in API routes after creating, updating, or deleting data
2. **Use appropriate cache durations**: Balance freshness with performance
3. **Tag caches properly**: Use user-specific tags to avoid cache pollution
4. **Monitor cache hit rates**: Use Next.js analytics to track cache effectiveness

## Migration Guide

### Converting Existing API Routes

1. Import invalidation functions:
\`\`\`typescript
import { invalidateNotesCache } from "@/lib/cache-config"
\`\`\`

2. Call after mutations:
\`\`\`typescript
// After successful mutation
await invalidateNotesCache(userId)
\`\`\`

### Example: Notes API Route

\`\`\`typescript
import { invalidateNotesCache } from "@/lib/cache-config"

export async function POST(req: Request) {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  
  // Create note logic...
  const { data, error } = await supabase.from("notes").insert(noteData)
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  
  // Invalidate cache
  await invalidateNotesCache(user.id)
  
  return NextResponse.json(data)
}
\`\`\`

## Performance Considerations

- **Cache hit rate**: Aim for >80% cache hit rate on frequently accessed data
- **Cache size**: Monitor memory usage, especially for large datasets
- **Revalidation timing**: Adjust durations based on user behavior patterns
- **Tag granularity**: Balance between precise invalidation and tag management overhead

## Future Improvements

- Implement cache warming for frequently accessed data
- Add cache metrics and monitoring
- Consider Redis for distributed caching in production
- Implement stale-while-revalidate patterns for better UX

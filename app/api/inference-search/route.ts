// v1 Social Search API: thin wrapper over shared handler
// Preserves v1-specific caching behavior
import { type NextRequest, NextResponse } from 'next/server'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { getOrgContext } from '@/lib/auth/get-org-context'
import { cache } from '@/lib/cache'
import { searchSticks, parseSearchParams } from '@/lib/handlers/inference-search-handler'

const RATE_LIMIT_HEADERS = { 'Retry-After': '30' }

export async function GET(request: NextRequest) {
  // Auth check
  const authResult = await getCachedAuthUser()
  if (authResult.rateLimited) {
    return NextResponse.json({ error: 'Rate limited' }, { status: 429, headers: RATE_LIMIT_HEADERS })
  }
  if (!authResult.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = authResult.user
  const orgContext = await getOrgContext()
  if (!orgContext) {
    return NextResponse.json({ error: 'No organization context' }, { status: 403 })
  }

  const params = parseSearchParams(request.nextUrl.searchParams)

  try {
    // Check v1 cache
    const cacheKey = `social-search:${orgContext.orgId}:${user.id}:${JSON.stringify({
      q: params.query, dateFrom: params.dateFrom, dateTo: params.dateTo,
      visibility: params.visibility, authorId: params.authorId, padId: params.padId,
      includeReplies: params.includeReplies, sortBy: params.sortBy, sortOrder: params.sortOrder,
      limit: params.limit, offset: params.offset,
    })}`

    const cached = cache.get<any>(cacheKey)
    if (cached) {
      return NextResponse.json(cached, {
        headers: { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60', 'X-Cache': 'HIT' },
      })
    }

    const result = await searchSticks(params, user, orgContext)

    // Cache for 1 minute
    cache.set(cacheKey, result.body, 60_000)

    return NextResponse.json(result.body, {
      headers: { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60', 'X-Cache': 'MISS' },
    })
  } catch (error) {
    console.error('[SocialSearch] Search error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

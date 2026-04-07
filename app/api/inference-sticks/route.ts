// v1 Social Sticks API: thin wrapper over shared handler
// Preserves v1-specific caching behavior via APICache
import { NextResponse } from 'next/server'
import { APICache } from '@/lib/api-cache'
import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from '@/lib/auth/cached-auth'
import { getOrgContext } from '@/lib/auth/get-org-context'
import { listSticks, createStick } from '@/lib/handlers/inference-sticks-handler'
import { toResponse } from '@/lib/handlers/inference-response'

const LOG_PREFIX = '[InferenceSticks]'

function parseQueryParams(request: Request) {
  const { searchParams } = new URL(request.url)
  const rawLimit = Number.parseInt(searchParams.get('limit') || '20', 10)
  const rawOffset = Number.parseInt(searchParams.get('offset') || '0', 10)
  return {
    isPublic: searchParams.get('public') === 'true',
    isAdmin: searchParams.get('admin') === 'true',
    isPrivate: searchParams.get('private') === 'true',
    cacheInvalidation: searchParams.get('_t'),
    limit: Math.min(Math.max(rawLimit, 1), 100),
    offset: Math.max(rawOffset, 0),
    userId: searchParams.get('userId'),
  }
}

export async function GET(request: Request) {
  try {
    const params = parseQueryParams(request)

    const { user, error: authError } = await getCachedAuthUser()
    if (authError === 'rate_limited') return createRateLimitResponse()

    const orgContext = user ? await getOrgContext() : null

    // For v1, we delegate to the shared handler for consistency
    // Cache invalidation for specific cache keys is preserved
    if (params.cacheInvalidation && user && orgContext) {
      const cacheKey = APICache.getCacheKey('social-sticks', {
        userId: user.id,
        orgId: orgContext.orgId,
        limit: params.limit,
        offset: params.offset,
        filterUserId: params.userId || undefined,
      })
      await APICache.invalidate(cacheKey)
    }

    const result = await listSticks(params, user, orgContext)
    return toResponse(result)
  } catch (error) {
    if (error instanceof Error && (error.message.includes('Too Many') || error.message.includes('429') || error.message === 'RATE_LIMITED')) {
      return createRateLimitResponse()
    }
    console.error(`${LOG_PREFIX} GET error:`, error)
    return NextResponse.json({ error: 'Failed to fetch social sticks' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { user, error: authError } = await getCachedAuthUser()
    if (authError === 'rate_limited') return createRateLimitResponse()
    if (!user) return createUnauthorizedResponse()

    const orgContext = await getOrgContext()
    if (!orgContext) {
      return NextResponse.json({ error: 'No organization context' }, { status: 403 })
    }

    const body = await request.json()
    const result = await createStick(body, user, orgContext)

    // Invalidate v1 caches after successful creation
    if (result.status === 200) {
      await Promise.all([
        APICache.invalidate(`social-sticks:userId=${user.id}:orgId=${orgContext.orgId}`),
        APICache.invalidate(`social-sticks:public=true`),
      ])
    }

    return toResponse(result)
  } catch (error) {
    console.error(`${LOG_PREFIX} POST error:`, error)
    return NextResponse.json({ error: 'Failed to create social stick' }, { status: 500 })
  }
}

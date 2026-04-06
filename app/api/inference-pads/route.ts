// v1 Social Pads API: thin wrapper over shared handler
// Preserves v1-specific caching behavior via APICache
import { NextResponse } from 'next/server'
import { APICache, withCache } from '@/lib/api-cache'
import { getSession } from '@/lib/auth/local-auth'
import { getOrgContext } from '@/lib/auth/get-org-context'
import { listPads, createPad } from '@/lib/handlers/inference-pads-handler'
import { toResponse } from '@/lib/handlers/inference-response'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const isPublic = searchParams.get('public') === 'true'
    const isAdmin = searchParams.get('admin') === 'true'
    const isPrivate = searchParams.get('private') === 'true'

    const session = await getSession()
    const user = session?.user || null
    const orgContext = user ? await getOrgContext() : null

    // For v1, wrap with cache for specific scenarios
    if (isPublic) {
      const cacheKey = APICache.getCacheKey('social-pads', { public: true })
      return withCache(
        cacheKey,
        async () => {
          const result = await listPads({ isPublic: true, isAdmin: false, isPrivate: false }, user, orgContext)
          return result.body
        },
        { ttl: 60, staleWhileRevalidate: 300 }
      )
    }

    if (isPrivate && user && orgContext) {
      const cacheKey = APICache.getCacheKey('social-pads', { private: true, userId: user.id, orgId: orgContext.orgId })
      return withCache(
        cacheKey,
        async () => {
          const result = await listPads({ isPublic: false, isAdmin: false, isPrivate: true }, user, orgContext)
          return result.body
        },
        { ttl: 30, staleWhileRevalidate: 60, tags: [`social-pads-${user.id}-${orgContext.orgId}`] }
      )
    }

    if (!isAdmin && user && orgContext) {
      const cacheKey = APICache.getCacheKey('social-pads', { userId: user.id, orgId: orgContext.orgId })
      return withCache(
        cacheKey,
        async () => {
          const result = await listPads({ isPublic: false, isAdmin: false, isPrivate: false }, user, orgContext)
          return result.body
        },
        { ttl: 30, staleWhileRevalidate: 60, tags: [`social-pads-${user.id}-${orgContext.orgId}`] }
      )
    }

    // Admin or no-cache scenarios
    const result = await listPads({ isPublic, isAdmin, isPrivate }, user, orgContext)
    return toResponse(result)
  } catch (error) {
    console.error('Error fetching social pads:', error)
    return NextResponse.json({ error: 'Failed to fetch social pads' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user

    const orgContext = await getOrgContext()
    if (!orgContext) {
      return NextResponse.json({ error: 'No organization context' }, { status: 403 })
    }

    const body = await request.json()
    const result = await createPad(body, user, orgContext)

    // Invalidate v1 caches after successful creation
    if (result.status === 200) {
      await APICache.invalidate(`social-pads:userId=${user.id}:orgId=${orgContext.orgId}`)
      await APICache.invalidate(`social-pads:public=true`)
    }

    return toResponse(result)
  } catch (error: any) {
    console.error('[v0] Error creating social pad:', error)
    return NextResponse.json({ error: error?.message || 'Failed to create social pad' }, { status: 500 })
  }
}

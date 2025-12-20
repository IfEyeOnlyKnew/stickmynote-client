// v2 Calsticks Cache API: production-quality, manage calsticks cache
import { type NextRequest } from 'next/server'
import { CalstickCache } from '@/lib/calstick-cache'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { handleApiError } from '@/lib/api/handle-api-error'

export const dynamic = 'force-dynamic'

// GET /api/v2/calsticks/cache - Get cache stats
export async function GET(request: NextRequest) {
  try {
    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) {
      return new Response(JSON.stringify({ error: 'Rate limited' }), {
        status: 429,
        headers: { 'Retry-After': '30' },
      })
    }
    if (!authResult.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }

    const stats = await CalstickCache.getStats()

    return new Response(
      JSON.stringify({
        cacheAvailable: stats.available,
        keyCount: stats.keyCount,
        userId: authResult.user.id,
      }),
      { status: 200 }
    )
  } catch (error) {
    return handleApiError(error)
  }
}

// DELETE /api/v2/calsticks/cache - Invalidate user cache
export async function DELETE(request: NextRequest) {
  try {
    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) {
      return new Response(JSON.stringify({ error: 'Rate limited' }), {
        status: 429,
        headers: { 'Retry-After': '30' },
      })
    }
    if (!authResult.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }

    await CalstickCache.invalidateUser(authResult.user.id)

    return new Response(
      JSON.stringify({ success: true, message: 'Cache invalidated for user' }),
      { status: 200 }
    )
  } catch (error) {
    return handleApiError(error)
  }
}

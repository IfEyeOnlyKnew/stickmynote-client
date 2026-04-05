// v2 Search Pads API: production-quality, search pads
import { type NextRequest } from 'next/server'
import { SearchEngine } from '@/lib/search-engine'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { getOrgContext } from '@/lib/auth/get-org-context'
import { handleApiError } from '@/lib/api/handle-api-error'

export const dynamic = 'force-dynamic'

// GET /api/v2/search/pads - Search pads
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('query') || ''
    const limit = Math.min(Number.parseInt(searchParams.get('limit') || '50'), 100)
    const offset = Math.max(Number.parseInt(searchParams.get('offset') || '0'), 0)
    const fuzzy = searchParams.get('fuzzy') !== 'false'

    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }),
        { status: 429, headers: { 'Retry-After': '30' } }
      )
    }
    if (!authResult.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }
    const user = authResult.user

    const orgContext = await getOrgContext()
    if (!orgContext) {
      return new Response(JSON.stringify({ error: 'No organization context' }), { status: 403 })
    }

    const result = await SearchEngine.searchPads({
      query,
      limit,
      offset,
      fuzzy,
      userId: user.id,
      orgId: orgContext.orgId,
    })

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        'Cache-Control': 'private, max-age=60, stale-while-revalidate=300',
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}

// v2 Search Panel API: production-quality, panel search
import { type NextRequest } from 'next/server'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { handleApiError } from '@/lib/api/handle-api-error'
import { panelSearch, getSearchSuggestions } from '@/lib/handlers/search-handler'

export const dynamic = 'force-dynamic'

// POST /api/v2/search/panel - Panel search
export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    const body = await request.json()
    const { page = 1 } = body

    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) {
      return new Response(
        JSON.stringify({
          error: 'Rate limit exceeded',
          notes: [],
          totalCount: 0,
          page,
          hasMore: false,
          searchDuration: Date.now() - startTime,
          rateLimited: true,
        }),
        { status: 429, headers: { 'Retry-After': '30' } }
      )
    }

    const result = await panelSearch(body)
    return new Response(JSON.stringify(result), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

// GET /api/v2/search/panel - Get suggestions
export async function GET(request: NextRequest) {
  try {
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

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'all'

    const suggestions = await getSearchSuggestions(authResult.user, type)
    return new Response(JSON.stringify(suggestions), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

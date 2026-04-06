// v2 Search Panel Suggestions API: production-quality, get search suggestions
import { type NextRequest } from 'next/server'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { handleApiError } from '@/lib/api/handle-api-error'
import { getSearchSuggestions } from '@/lib/handlers/search-handler'

export const dynamic = 'force-dynamic'

// GET /api/v2/search/panel/suggestions - Get search suggestions
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

    const suggestions = await getSearchSuggestions(authResult.user)
    return new Response(JSON.stringify(suggestions), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

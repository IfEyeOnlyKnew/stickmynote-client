// v2 Admin User Lookup API: production-quality, lookup user by email
import { type NextRequest } from 'next/server'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { handleApiError } from '@/lib/api/handle-api-error'
import { lookupUser } from '@/lib/handlers/admin-handler'

export const dynamic = 'force-dynamic'

// GET /api/v2/admin/user-lookup - Look up user by email
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

    const email = request.nextUrl.searchParams.get('email')
    const result = await lookupUser(authResult.user, email || '')

    if (result.error) {
      return new Response(
        JSON.stringify({ error: result.error, ...(result.data || {}) }),
        { status: result.status }
      )
    }

    return new Response(JSON.stringify(result.data), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

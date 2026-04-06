// v2 Search Advanced API: production-quality, advanced search with filters
import { type NextRequest } from 'next/server'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { handleApiError } from '@/lib/api/handle-api-error'
import { executeAdvancedSearch } from '@/lib/handlers/search-advanced-handler'
import { rateLimitResponse, unauthorizedResponse } from '@/lib/handlers/inference-response'

export const dynamic = 'force-dynamic'

// POST /api/v2/search/advanced - Advanced search with filters
export async function POST(request: NextRequest) {
  try {
    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) return rateLimitResponse()
    if (!authResult.user) return unauthorizedResponse()

    const body = await request.json()

    const result = await executeAdvancedSearch(authResult.user.id, body, {
      table: 'personal_sticks',
      replyTable: 'personal_sticks_replies',
      replyForeignKey: 'personal_stick_id',
    })

    return new Response(JSON.stringify(result), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

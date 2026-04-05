// v2 AI Check Duplicate API: production-quality, check for duplicate content
import { db } from '@/lib/database/pg-client'
import { AIService } from '@/lib/ai/ai-service'
import { getOrgContext } from '@/lib/auth/get-org-context'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { handleApiError } from '@/lib/api/handle-api-error'

export const dynamic = 'force-dynamic'

// POST /api/v2/ai/check-duplicate - Check if content is duplicate
export async function POST(request: Request) {
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

    const orgContext = await getOrgContext()
    if (!orgContext) {
      return new Response(JSON.stringify({ error: 'No organization context' }), { status: 403 })
    }

    const { content, padId } = await request.json()

    if (!content || !padId) {
      return new Response(JSON.stringify({ error: 'Content and padId are required' }), {
        status: 400,
      })
    }

    // Fetch existing sticks
    const sticksResult = await db.query(
      `SELECT id, content, topic
       FROM social_sticks
       WHERE social_pad_id = $1 AND org_id = $2
       ORDER BY created_at DESC
       LIMIT 20`,
      [padId, orgContext.orgId]
    )

    const result = await AIService.checkDuplicate(content, sticksResult.rows || [])

    return new Response(JSON.stringify(result), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

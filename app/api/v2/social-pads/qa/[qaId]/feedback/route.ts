// v2 Social Pads QA Feedback API: production-quality, submit feedback on Q&A
import { type NextRequest } from 'next/server'
import { db } from '@/lib/database/pg-client'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { handleApiError } from '@/lib/api/handle-api-error'

export const dynamic = 'force-dynamic'

// POST /api/v2/social-pads/qa/[qaId]/feedback - Submit feedback
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ qaId: string }> }
) {
  try {
    const { qaId } = await params

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

    const body = await request.json()
    const { was_helpful, feedback_text } = body

    // Update the Q&A record with feedback
    await db.query(
      `UPDATE social_qa_history
       SET was_helpful = $1, feedback_text = $2
       WHERE id = $3 AND asked_by = $4`,
      [was_helpful, feedback_text || null, qaId, user.id]
    )

    return new Response(JSON.stringify({ success: true }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

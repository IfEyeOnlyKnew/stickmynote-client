// v2 Social Pads Ask API: production-quality, AI-powered Q&A for pad content
import { type NextRequest } from 'next/server'
import { db } from '@/lib/database/pg-client'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { getOrgContext } from '@/lib/auth/get-org-context'
import { handleApiError } from '@/lib/api/handle-api-error'
import { AIService } from '@/lib/ai/ai-service'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

// POST /api/v2/inference-pads/[padId]/ask - Ask AI about pad content
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ padId: string }> }
) {
  try {
    const { padId } = await params

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

    const body = await request.json()
    const { question } = body

    if (!question || typeof question !== 'string') {
      return new Response(JSON.stringify({ error: 'Question is required' }), { status: 400 })
    }

    // Fetch all sticks in the pad
    const sticksResult = await db.query(
      `SELECT id, topic, content, live_summary, reply_count
       FROM social_sticks
       WHERE social_pad_id = $1 AND org_id = $2
       ORDER BY created_at DESC
       LIMIT 20`,
      [padId, orgContext.orgId]
    )

    const sticks = sticksResult.rows

    if (sticks.length === 0) {
      return new Response(
        JSON.stringify({
          answer: 'There are no sticks in this pad yet to answer questions about.',
          citations: [],
        }),
        { status: 200 }
      )
    }

    // Use AI to answer the question
    const result = await AIService.answerPadQuestion({
      question,
      sticks: sticks.map((s: any) => ({
        topic: s.topic || 'Untitled',
        content: s.content,
        summary: s.live_summary || undefined,
        replies_count: s.reply_count || 0,
      })),
    })

    // Save Q&A history
    let qaId = null
    try {
      const qaResult = await db.query(
        `INSERT INTO social_qa_history
         (social_pad_id, org_id, question, answer, citations, asked_by)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [padId, orgContext.orgId, question, result.answer, JSON.stringify(result.citations), user.id]
      )
      qaId = qaResult.rows[0]?.id || null
    } catch (qaError) {
      console.error('Error saving Q&A history:', qaError)
      // Don't fail the request, just log the error
    }

    return new Response(
      JSON.stringify({
        answer: result.answer,
        citations: result.citations,
        sticksSearched: sticks.length,
        qa_id: qaId,
      }),
      { status: 200 }
    )
  } catch (error) {
    return handleApiError(error)
  }
}

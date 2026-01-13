// v2 AI Ask API: production-quality, AI Q&A with session tracking
import { db } from '@/lib/database/pg-client'
import { generateText, isAIAvailable } from '@/lib/ai/ai-provider'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { handleApiError } from '@/lib/api/handle-api-error'

export const dynamic = 'force-dynamic'

// POST /api/v2/ai/ask - Ask AI a question
export async function POST(request: Request) {
  try {
    if (!isAIAvailable()) {
      return new Response(JSON.stringify({ error: 'AI service not configured' }), { status: 500 })
    }

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

    const { stickId, stickType, question } = await request.json()

    if (!stickId || !stickType || !question) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400 })
    }

    if (question.length > 200) {
      return new Response(JSON.stringify({ error: 'Question exceeds 200 characters' }), {
        status: 400,
      })
    }

    // Get user's organization
    const memberResult = await db.query(
      `SELECT org_id FROM organization_members WHERE user_id = $1 LIMIT 1`,
      [user.id]
    )
    const orgId = memberResult.rows[0]?.org_id

    // Check remaining sessions
    let maxSessions = 2
    if (orgId) {
      const orgResult = await db.query(
        `SELECT ai_sessions_per_day FROM organizations WHERE id = $1`,
        [orgId]
      )
      if (orgResult.rows[0]?.ai_sessions_per_day) {
        maxSessions = orgResult.rows[0].ai_sessions_per_day
      }
    }

    const today = new Date().toISOString().split('T')[0]

    let sessionCount = 0
    try {
      const sessionsResult = await db.query(
        `SELECT id FROM ai_answer_sessions WHERE user_id = $1 AND session_date = $2`,
        [user.id, today]
      )
      sessionCount = sessionsResult.rows.length
    } catch {
      console.log('ai_answer_sessions table not available, skipping limit check')
    }

    if (sessionCount >= maxSessions) {
      return new Response(
        JSON.stringify({ error: 'Daily AI session limit reached. Try again tomorrow.' }),
        { status: 429 }
      )
    }

    // Generate answer using AI SDK
    const prompt = `You are a helpful assistant. Please provide a clear, concise, and informative answer to the following question:

Question: ${question}

Provide a helpful answer. If you need more context to answer properly, explain what additional information would be helpful.`

    const { text: answer } = await generateText({
      prompt,
      maxTokens: 500,
    })

    // Log the session
    try {
      await db.query(
        `INSERT INTO ai_answer_sessions (user_id, org_id, stick_id, stick_type, question, answer, session_date)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [user.id, orgId, stickId, stickType, question, answer, today]
      )
    } catch {
      console.log('Could not log AI session, table may not exist')
    }

    return new Response(JSON.stringify({ answer }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

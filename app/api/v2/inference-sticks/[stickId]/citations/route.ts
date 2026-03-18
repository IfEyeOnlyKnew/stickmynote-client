// v2 Social Sticks Citations API: production-quality, manage stick citations
import { type NextRequest } from 'next/server'
import { db } from '@/lib/database/pg-client'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { handleApiError } from '@/lib/api/handle-api-error'

export const dynamic = 'force-dynamic'

// GET /api/v2/inference-sticks/[stickId]/citations - Get citations
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ stickId: string }> }
) {
  try {
    const { stickId } = await params

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

    // Get citations with KB article info
    const citationsResult = await db.query(
      `SELECT c.*, kb.id as kb_id, kb.title as kb_title, kb.category as kb_category, kb.tags as kb_tags
       FROM social_stick_citations c
       LEFT JOIN social_pad_knowledge_base kb ON c.kb_article_id = kb.id
       WHERE c.stick_id = $1
       ORDER BY c.created_at DESC`,
      [stickId]
    )

    // Get user info for cited_by
    const citedByIds = [...new Set(citationsResult.rows.map((c: any) => c.cited_by).filter(Boolean))]
    let usersMap: Record<string, any> = {}

    if (citedByIds.length > 0) {
      const usersResult = await db.query(
        `SELECT id, full_name, email, avatar_url FROM users WHERE id = ANY($1)`,
        [citedByIds]
      )
      usersMap = usersResult.rows.reduce((acc: any, u: any) => {
        acc[u.id] = u
        return acc
      }, {})
    }

    const citationsWithData = citationsResult.rows.map((c: any) => ({
      ...c,
      kb_article: c.kb_id
        ? { id: c.kb_id, title: c.kb_title, category: c.kb_category, tags: c.kb_tags }
        : null,
      cited_by_user: c.cited_by ? usersMap[c.cited_by] || null : null,
    }))

    return new Response(JSON.stringify({ citations: citationsWithData }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

// POST /api/v2/inference-sticks/[stickId]/citations - Add citation
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ stickId: string }> }
) {
  try {
    const { stickId } = await params

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
    const { kb_article_id, citation_type, citation_note, external_url, external_title } = body

    if (!kb_article_id && !external_url) {
      return new Response(
        JSON.stringify({ error: 'Either KB article or external URL is required' }),
        { status: 400 }
      )
    }

    // Create citation
    const citationResult = await db.query(
      `INSERT INTO social_stick_citations
       (stick_id, kb_article_id, citation_type, citation_note, external_url, external_title, cited_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        stickId,
        kb_article_id || null,
        citation_type || 'reference',
        citation_note || null,
        external_url || null,
        external_title || null,
        user.id,
      ]
    )

    const citation = citationResult.rows[0]

    // Get KB article if exists
    let kbArticle = null
    if (citation.kb_article_id) {
      const kbResult = await db.query(
        `SELECT id, title, category, tags FROM social_pad_knowledge_base WHERE id = $1`,
        [citation.kb_article_id]
      )
      kbArticle = kbResult.rows[0] || null
    }

    // Get user info
    const userResult = await db.query(
      `SELECT id, full_name, email, avatar_url FROM users WHERE id = $1`,
      [user.id]
    )

    return new Response(
      JSON.stringify({
        citation: {
          ...citation,
          kb_article: kbArticle,
          cited_by_user: userResult.rows[0] || null,
        },
      }),
      { status: 200 }
    )
  } catch (error) {
    return handleApiError(error)
  }
}

// DELETE /api/v2/inference-sticks/[stickId]/citations - Remove citation
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ stickId: string }> }
) {
  try {
    const { stickId } = await params
    const { searchParams } = new URL(request.url)
    const citationId = searchParams.get('citationId')

    if (!citationId) {
      return new Response(JSON.stringify({ error: 'Citation ID is required' }), { status: 400 })
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

    await db.query(
      `DELETE FROM social_stick_citations WHERE id = $1 AND stick_id = $2`,
      [citationId, stickId]
    )

    return new Response(JSON.stringify({ success: true }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

// v2 Social Pads Knowledge Base Search API: production-quality, search KB articles
import { type NextRequest } from 'next/server'
import { db } from '@/lib/database/pg-client'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { handleApiError } from '@/lib/api/handle-api-error'

export const dynamic = 'force-dynamic'

// GET /api/v2/social-pads/[padId]/knowledge-base/search - Search KB articles
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ padId: string }> }
) {
  try {
    const { padId } = await params
    const { searchParams } = new URL(request.url)
    const tags = searchParams.get('tags')?.split(',').filter(Boolean) || []
    const query = searchParams.get('query') || ''

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

    // Build search query
    let sqlQuery = `SELECT * FROM social_pad_knowledge_base WHERE social_pad_id = $1`
    const queryParams: any[] = [padId]
    let paramIndex = 2

    // Search by tags (overlap)
    if (tags.length > 0) {
      sqlQuery += ` AND tags && $${paramIndex}`
      queryParams.push(tags)
      paramIndex++
    }

    // Search by text query
    if (query) {
      sqlQuery += ` AND (title ILIKE $${paramIndex} OR content ILIKE $${paramIndex})`
      queryParams.push(`%${query}%`)
      paramIndex++
    }

    sqlQuery += ` ORDER BY helpful_count DESC NULLS LAST, view_count DESC NULLS LAST LIMIT 10`

    const result = await db.query(sqlQuery, queryParams)

    // Attach authors to articles
    const articlesWithAuthors = await Promise.all(
      result.rows.map(async (article: any) => {
        if (article.author_id) {
          const authorResult = await db.query(
            `SELECT id, full_name, email, avatar_url FROM users WHERE id = $1`,
            [article.author_id]
          )
          return { ...article, author: authorResult.rows[0] || null }
        }
        return { ...article, author: null }
      })
    )

    return new Response(JSON.stringify({ articles: articlesWithAuthors }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

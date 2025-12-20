// v2 Social Pads Knowledge Base API: production-quality, CRUD for KB articles
import { type NextRequest } from 'next/server'
import { db } from '@/lib/database/pg-client'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { handleApiError } from '@/lib/api/handle-api-error'

export const dynamic = 'force-dynamic'

// Helper to attach author to article
async function attachAuthor(article: any) {
  if (article.author_id) {
    const result = await db.query(
      `SELECT id, full_name, email, avatar_url FROM users WHERE id = $1`,
      [article.author_id]
    )
    return { ...article, author: result.rows[0] || null }
  }
  return { ...article, author: null }
}

// GET /api/v2/social-pads/[padId]/knowledge-base - Get all KB articles
export async function GET(
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

    const result = await db.query(
      `SELECT * FROM social_pad_knowledge_base
       WHERE social_pad_id = $1
       ORDER BY is_pinned DESC NULLS LAST, pin_order ASC NULLS LAST, created_at DESC`,
      [padId]
    )

    const articlesWithAuthors = await Promise.all(
      result.rows.map((article: any) => attachAuthor(article))
    )

    return new Response(JSON.stringify({ articles: articlesWithAuthors }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

// POST /api/v2/social-pads/[padId]/knowledge-base - Create KB article
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

    const body = await request.json()
    const { title, content, category, tags } = body

    if (!title || !content) {
      return new Response(
        JSON.stringify({ error: 'Title and content are required' }),
        { status: 400 }
      )
    }

    const result = await db.query(
      `INSERT INTO social_pad_knowledge_base
       (social_pad_id, title, content, category, tags, author_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [padId, title, content, category || 'general', tags || [], user.id]
    )

    if (result.rows.length === 0) {
      return new Response(JSON.stringify({ error: 'Failed to create article' }), { status: 500 })
    }

    const articleWithAuthor = await attachAuthor(result.rows[0])

    return new Response(JSON.stringify({ article: articleWithAuthor }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

// PATCH /api/v2/social-pads/[padId]/knowledge-base - Update KB article
export async function PATCH(
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

    const body = await request.json()
    const { articleId, title, content, category, tags, is_pinned, pin_order } = body

    if (!articleId) {
      return new Response(JSON.stringify({ error: 'Article ID is required' }), { status: 400 })
    }

    // Build update query dynamically
    const updates: string[] = []
    const values: any[] = []
    let paramIndex = 1

    if (title !== undefined) {
      updates.push(`title = $${paramIndex++}`)
      values.push(title)
    }
    if (content !== undefined) {
      updates.push(`content = $${paramIndex++}`)
      values.push(content)
    }
    if (category !== undefined) {
      updates.push(`category = $${paramIndex++}`)
      values.push(category)
    }
    if (tags !== undefined) {
      updates.push(`tags = $${paramIndex++}`)
      values.push(tags)
    }
    if (is_pinned !== undefined) {
      updates.push(`is_pinned = $${paramIndex++}`)
      values.push(is_pinned)
    }
    if (pin_order !== undefined) {
      updates.push(`pin_order = $${paramIndex++}`)
      values.push(pin_order)
    }

    if (updates.length === 0) {
      return new Response(JSON.stringify({ error: 'No fields to update' }), { status: 400 })
    }

    values.push(articleId, padId)

    const result = await db.query(
      `UPDATE social_pad_knowledge_base
       SET ${updates.join(', ')}, updated_at = NOW()
       WHERE id = $${paramIndex++} AND social_pad_id = $${paramIndex}
       RETURNING *`,
      values
    )

    if (result.rows.length === 0) {
      return new Response(JSON.stringify({ error: 'Article not found' }), { status: 404 })
    }

    const articleWithAuthor = await attachAuthor(result.rows[0])

    return new Response(JSON.stringify({ article: articleWithAuthor }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

// DELETE /api/v2/social-pads/[padId]/knowledge-base - Delete KB article
export async function DELETE(
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

    const { searchParams } = new URL(request.url)
    const articleId = searchParams.get('articleId')

    if (!articleId) {
      return new Response(JSON.stringify({ error: 'Article ID is required' }), { status: 400 })
    }

    await db.query(
      `DELETE FROM social_pad_knowledge_base WHERE id = $1 AND social_pad_id = $2`,
      [articleId, padId]
    )

    return new Response(JSON.stringify({ success: true }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

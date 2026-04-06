// v2 Social Pads Knowledge Base API: production-quality, CRUD for KB articles
import { type NextRequest } from 'next/server'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { handleApiError } from '@/lib/api/handle-api-error'
import {
  getKnowledgeBaseArticles,
  createKnowledgeBaseArticle,
  updateKnowledgeBaseArticle,
  deleteKnowledgeBaseArticle,
} from '@/lib/handlers/inference-pads-knowledge-base-handler'
import { rateLimitResponse, unauthorizedResponse } from '@/lib/handlers/inference-response'

export const dynamic = 'force-dynamic'

// GET /api/v2/inference-pads/[padId]/knowledge-base - Get all KB articles
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ padId: string }> }
) {
  try {
    const { padId } = await params

    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) return rateLimitResponse()
    if (!authResult.user) return unauthorizedResponse()

    const articles = await getKnowledgeBaseArticles(padId)
    return new Response(JSON.stringify({ articles }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

// POST /api/v2/inference-pads/[padId]/knowledge-base - Create KB article
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ padId: string }> }
) {
  try {
    const { padId } = await params

    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) return rateLimitResponse()
    if (!authResult.user) return unauthorizedResponse()

    const body = await request.json()
    const { title, content, category, tags } = body

    if (!title || !content) {
      return new Response(
        JSON.stringify({ error: 'Title and content are required' }),
        { status: 400 }
      )
    }

    const article = await createKnowledgeBaseArticle(padId, authResult.user.id, { title, content, category, tags })
    if (!article) {
      return new Response(JSON.stringify({ error: 'Failed to create article' }), { status: 500 })
    }

    return new Response(JSON.stringify({ article }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

// PATCH /api/v2/inference-pads/[padId]/knowledge-base - Update KB article
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ padId: string }> }
) {
  try {
    const { padId } = await params

    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) return rateLimitResponse()
    if (!authResult.user) return unauthorizedResponse()

    const body = await request.json()
    const { articleId, title, content, category, tags, is_pinned, pin_order } = body

    if (!articleId) {
      return new Response(JSON.stringify({ error: 'Article ID is required' }), { status: 400 })
    }

    const article = await updateKnowledgeBaseArticle(padId, articleId, { title, content, category, tags, is_pinned, pin_order })

    if (article === undefined) {
      return new Response(JSON.stringify({ error: 'No fields to update' }), { status: 400 })
    }
    if (article === null) {
      return new Response(JSON.stringify({ error: 'Article not found' }), { status: 404 })
    }

    return new Response(JSON.stringify({ article }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

// DELETE /api/v2/inference-pads/[padId]/knowledge-base - Delete KB article
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ padId: string }> }
) {
  try {
    const { padId } = await params

    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) return rateLimitResponse()
    if (!authResult.user) return unauthorizedResponse()

    const { searchParams } = new URL(request.url)
    const articleId = searchParams.get('articleId')

    if (!articleId) {
      return new Response(JSON.stringify({ error: 'Article ID is required' }), { status: 400 })
    }

    await deleteKnowledgeBaseArticle(padId, articleId)
    return new Response(JSON.stringify({ success: true }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

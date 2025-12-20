// v2 Tags API: production-quality, CRUD
import { NextRequest } from 'next/server'
import { requireADSession } from '@/lib/auth/ad-session'
import { handleApiError } from '@/lib/api/handle-api-error'
import { listTags, createTag, updateTag, deleteTag } from '@/lib/handlers/tags-handler'

// GET /api/v2/tags - List tags for user/org
export async function GET(request: NextRequest) {
  try {
    const session = await requireADSession(request)
    const result = await listTags(session)
    return new Response(JSON.stringify(result.body), { status: result.status })
  } catch (error) {
    return handleApiError(error)
  }
}

// POST /api/v2/tags - Create tag
export async function POST(request: NextRequest) {
  try {
    const session = await requireADSession(request)
    const body = await request.json()
    const result = await createTag(session, body)
    return new Response(JSON.stringify(result.body), { status: result.status })
  } catch (error) {
    return handleApiError(error)
  }
}

// PUT /api/v2/tags?id=... - Update tag
export async function PUT(request: NextRequest) {
  try {
    const session = await requireADSession(request)
    const url = new URL(request.url)
    const tagId = url.searchParams.get('id') || ''
    const body = await request.json()
    const result = await updateTag(session, tagId, body)
    return new Response(JSON.stringify(result.body), { status: result.status })
  } catch (error) {
    return handleApiError(error)
  }
}

// DELETE /api/v2/tags?id=... - Delete tag
export async function DELETE(request: NextRequest) {
  try {
    const session = await requireADSession(request)
    const url = new URL(request.url)
    const tagId = url.searchParams.get('id') || ''
    const result = await deleteTag(session, tagId)
    return new Response(JSON.stringify(result.body), { status: result.status })
  } catch (error) {
    return handleApiError(error)
  }
}

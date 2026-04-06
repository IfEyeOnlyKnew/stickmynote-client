// v2 Calsticks Attachments API: production-quality, manage calstick attachments
import { type NextRequest } from 'next/server'
import { getOrgContext } from '@/lib/auth/get-org-context'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { handleApiError } from '@/lib/api/handle-api-error'
import {
  verifyCalstickOwnership,
  getAttachments,
  createAttachment,
  deleteAttachment,
} from '@/lib/handlers/calsticks-attachments-handler'

export const dynamic = 'force-dynamic'

// GET /api/v2/calsticks/[id]/attachments - Get attachments for a calstick
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
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

    const isOwner = await verifyCalstickOwnership(id, authResult.user.id, orgContext.orgId)
    if (!isOwner) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 })
    }

    const result = await getAttachments(id, orgContext.orgId)
    return new Response(JSON.stringify(result), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

// POST /api/v2/calsticks/[id]/attachments - Add attachment to a calstick
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
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

    const isOwner = await verifyCalstickOwnership(id, authResult.user.id, orgContext.orgId)
    if (!isOwner) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 })
    }

    const body = await request.json()
    const result = await createAttachment(id, orgContext.orgId, authResult.user.id, body)
    return new Response(JSON.stringify(result), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

// DELETE /api/v2/calsticks/[id]/attachments - Delete attachment from a calstick
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await params
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

    const { searchParams } = new URL(request.url)
    const attachmentId = searchParams.get('attachmentId')

    if (!attachmentId) {
      return new Response(JSON.stringify({ error: 'Attachment ID required' }), { status: 400 })
    }

    const result = await deleteAttachment(attachmentId, orgContext.orgId, authResult.user.id)
    return new Response(JSON.stringify(result), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

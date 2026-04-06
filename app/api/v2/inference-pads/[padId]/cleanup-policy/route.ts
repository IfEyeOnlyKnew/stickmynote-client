// v2 Social Pads Cleanup Policy API: production-quality, manage cleanup policies
import { type NextRequest } from 'next/server'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { handleApiError } from '@/lib/api/handle-api-error'
import { checkCleanupAccess, getCleanupPolicy, upsertCleanupPolicy, deleteCleanupPolicy } from '@/lib/handlers/inference-pads-cleanup-handler'
import { rateLimitResponse, unauthorizedResponse } from '@/lib/handlers/inference-response'

export const dynamic = 'force-dynamic'

// GET /api/v2/inference-pads/[padId]/cleanup-policy - Get cleanup policy
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ padId: string }> }
) {
  try {
    const { padId } = await params

    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) return rateLimitResponse()
    if (!authResult.user) return unauthorizedResponse()

    const { padExists, isOwner, isAdmin } = await checkCleanupAccess(padId, authResult.user.id)
    if (!padExists) {
      return new Response(JSON.stringify({ error: 'Pad not found' }), { status: 404 })
    }
    if (!isOwner && !isAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 })
    }

    const policy = await getCleanupPolicy(padId)
    return new Response(JSON.stringify({ policy }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

// PUT /api/v2/inference-pads/[padId]/cleanup-policy - Update cleanup policy
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ padId: string }> }
) {
  try {
    const { padId } = await params

    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) return rateLimitResponse()
    if (!authResult.user) return unauthorizedResponse()

    const { padExists, isOwner } = await checkCleanupAccess(padId, authResult.user.id)
    if (!padExists) {
      return new Response(JSON.stringify({ error: 'Pad not found' }), { status: 404 })
    }
    if (!isOwner) {
      return new Response(
        JSON.stringify({ error: 'Only pad owner can update cleanup policy' }),
        { status: 403 }
      )
    }

    const body = await request.json()
    const policy = await upsertCleanupPolicy(padId, authResult.user.id, body)
    return new Response(JSON.stringify({ policy }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

// DELETE /api/v2/inference-pads/[padId]/cleanup-policy - Delete cleanup policy
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ padId: string }> }
) {
  try {
    const { padId } = await params

    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) return rateLimitResponse()
    if (!authResult.user) return unauthorizedResponse()

    const { padExists, isOwner } = await checkCleanupAccess(padId, authResult.user.id)
    if (!padExists || !isOwner) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 })
    }

    await deleteCleanupPolicy(padId)
    return new Response(JSON.stringify({ success: true }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

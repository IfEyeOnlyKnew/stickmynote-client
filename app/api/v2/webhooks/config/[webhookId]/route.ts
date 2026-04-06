// v2 Webhooks Config [webhookId] API: production-quality, get/update/delete webhook
import { type NextRequest } from 'next/server'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { handleApiError } from '@/lib/api/handle-api-error'
import { getWebhookConfig, updateWebhookConfig, deleteWebhookConfig } from '@/lib/handlers/webhooks-config-handler'
import { toResponse, rateLimitResponse, unauthorizedResponse } from '@/lib/handlers/inference-response'

export const dynamic = 'force-dynamic'

// GET /api/v2/webhooks/config/[webhookId] - Get webhook details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ webhookId: string }> }
) {
  try {
    const { webhookId } = await params

    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) return rateLimitResponse()
    if (!authResult.user) return unauthorizedResponse()

    const result = await getWebhookConfig(webhookId, authResult.user.id)
    return toResponse(result)
  } catch (error) {
    return handleApiError(error)
  }
}

// PATCH /api/v2/webhooks/config/[webhookId] - Update webhook
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ webhookId: string }> }
) {
  try {
    const { webhookId } = await params

    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) return rateLimitResponse()
    if (!authResult.user) return unauthorizedResponse()

    const body = await request.json()
    const result = await updateWebhookConfig(webhookId, authResult.user.id, body)
    return toResponse(result)
  } catch (error) {
    return handleApiError(error)
  }
}

// DELETE /api/v2/webhooks/config/[webhookId] - Delete webhook
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ webhookId: string }> }
) {
  try {
    const { webhookId } = await params

    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) return rateLimitResponse()
    if (!authResult.user) return unauthorizedResponse()

    await deleteWebhookConfig(webhookId, authResult.user.id)
    return new Response(JSON.stringify({ success: true }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

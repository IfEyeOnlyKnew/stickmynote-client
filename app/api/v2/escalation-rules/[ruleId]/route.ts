// v2 Escalation Rules [ruleId] API: production-quality, manage single rule
import { type NextRequest } from 'next/server'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { handleApiError } from '@/lib/api/handle-api-error'
import { getEscalationRule, updateEscalationRule, deleteEscalationRule } from '@/lib/handlers/escalation-rules-detail-handler'
import { toResponse, rateLimitResponse, unauthorizedResponse } from '@/lib/handlers/inference-response'

export const dynamic = 'force-dynamic'

// GET /api/v2/escalation-rules/[ruleId] - Get a specific rule
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ ruleId: string }> }
) {
  try {
    const { ruleId } = await params

    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) return rateLimitResponse()
    if (!authResult.user) return unauthorizedResponse()

    const result = await getEscalationRule(ruleId, authResult.user.id)
    return toResponse(result)
  } catch (error) {
    return handleApiError(error)
  }
}

// PATCH /api/v2/escalation-rules/[ruleId] - Update a rule
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ ruleId: string }> }
) {
  try {
    const { ruleId } = await params

    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) return rateLimitResponse()
    if (!authResult.user) return unauthorizedResponse()

    const body = await request.json()
    const result = await updateEscalationRule(ruleId, authResult.user.id, body)
    return toResponse(result)
  } catch (error) {
    return handleApiError(error)
  }
}

// DELETE /api/v2/escalation-rules/[ruleId] - Delete a rule
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ ruleId: string }> }
) {
  try {
    const { ruleId } = await params

    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) return rateLimitResponse()
    if (!authResult.user) return unauthorizedResponse()

    await deleteEscalationRule(ruleId, authResult.user.id)
    return new Response(JSON.stringify({ success: true }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

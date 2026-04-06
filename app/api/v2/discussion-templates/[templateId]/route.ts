// v2 Discussion Templates API: Get, update, delete single template
import { type NextRequest } from "next/server"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { handleApiError } from "@/lib/api/handle-api-error"
import { getTemplate, updateTemplate, deleteTemplate } from "@/lib/handlers/discussion-templates-detail-handler"
import { toResponse, rateLimitResponse, unauthorizedResponse } from "@/lib/handlers/inference-response"
import type { UpdateTemplateRequest } from "@/types/discussion-templates"

export const dynamic = "force-dynamic"

// GET /api/v2/discussion-templates/[templateId] - Get single template
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ templateId: string }> }
) {
  try {
    const { templateId } = await params

    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) return rateLimitResponse()
    if (!authResult.user) return unauthorizedResponse()

    const orgContext = await getOrgContext()
    const result = await getTemplate(templateId, authResult.user.id, orgContext)
    return toResponse(result)
  } catch (error) {
    return handleApiError(error)
  }
}

// PATCH /api/v2/discussion-templates/[templateId] - Update template
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ templateId: string }> }
) {
  try {
    const { templateId } = await params

    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) return rateLimitResponse()
    if (!authResult.user) return unauthorizedResponse()

    const orgContext = await getOrgContext()
    const body: UpdateTemplateRequest = await request.json()
    const result = await updateTemplate(templateId, authResult.user.id, orgContext, body)
    return toResponse(result)
  } catch (error) {
    return handleApiError(error)
  }
}

// DELETE /api/v2/discussion-templates/[templateId] - Delete template
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ templateId: string }> }
) {
  try {
    const { templateId } = await params

    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) return rateLimitResponse()
    if (!authResult.user) return unauthorizedResponse()

    const orgContext = await getOrgContext()
    const result = await deleteTemplate(templateId, authResult.user.id, orgContext)
    return toResponse(result)
  } catch (error) {
    return handleApiError(error)
  }
}

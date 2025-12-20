// v2 Templates API: production-quality, CRUD
import { NextRequest } from 'next/server'
import { requireADSession } from '@/lib/auth/ad-session'
import { handleApiError } from '@/lib/api/handle-api-error'
import { listTemplates, createTemplate } from '@/lib/handlers/templates-handler'

// GET /api/v2/templates - List templates for user/org
export async function GET(request: NextRequest) {
  try {
    const session = await requireADSession(request)
    const result = await listTemplates(session)
    return new Response(JSON.stringify(result.body), { status: result.status })
  } catch (error) {
    return handleApiError(error)
  }
}

// POST /api/v2/templates - Create template
export async function POST(request: NextRequest) {
  try {
    const session = await requireADSession(request)
    const body = await request.json()
    const result = await createTemplate(session, body)
    return new Response(JSON.stringify(result.body), { status: result.status })
  } catch (error) {
    return handleApiError(error)
  }
}

// v2 Webhooks API: production-quality, register and list webhooks
import { NextRequest } from 'next/server'
import { requireADSession } from '@/lib/auth/ad-session'
import { handleApiError } from '@/lib/api/handle-api-error'
import { listWebhooks, createWebhook } from '@/lib/handlers/webhooks-handler'

// POST /api/v2/webhooks - Register a webhook
export async function POST(request: NextRequest) {
  try {
    const session = await requireADSession(request)
    const body = await request.json()
    const result = await createWebhook(session, body)
    return new Response(JSON.stringify(result.body), { status: result.status })
  } catch (error) {
    return handleApiError(error)
  }
}

// GET /api/v2/webhooks - List webhooks for user/org
export async function GET(request: NextRequest) {
  try {
    const session = await requireADSession(request)
    const result = await listWebhooks(session)
    return new Response(JSON.stringify(result.body), { status: result.status })
  } catch (error) {
    return handleApiError(error)
  }
}

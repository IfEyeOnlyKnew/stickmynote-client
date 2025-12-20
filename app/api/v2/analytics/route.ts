// v2 Analytics API: production-quality, simple event logging
import { NextRequest } from 'next/server'
import { requireADSession } from '@/lib/auth/ad-session'
import { handleApiError } from '@/lib/api/handle-api-error'
import { logAnalyticsEvent } from '@/lib/handlers/analytics-handler'

// POST /api/v2/analytics - Log an analytics event
export async function POST(request: NextRequest) {
  try {
    const session = await requireADSession(request)
    const body = await request.json()
    const result = await logAnalyticsEvent(session, body)
    return new Response(JSON.stringify(result.body), { status: result.status })
  } catch (error) {
    return handleApiError(error)
  }
}

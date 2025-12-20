// v2 Calsticks API: production-quality, calendar stick events
import { NextRequest } from 'next/server'
import { requireADSession } from '@/lib/auth/ad-session'
import { handleApiError } from '@/lib/api/handle-api-error'
import { listCalsticks, createCalstick, updateCalstick, deleteCalstick } from '@/lib/handlers/calsticks-handler'

// GET /api/v2/calsticks - List calendar stick events for user/org
export async function GET(request: NextRequest) {
  try {
    const session = await requireADSession(request)
    const url = new URL(request.url)
    const limit = Number(url.searchParams.get('limit')) || 50
    const result = await listCalsticks(session, limit)
    return new Response(JSON.stringify(result.body), { status: result.status })
  } catch (error) {
    return handleApiError(error)
  }
}

// POST /api/v2/calsticks - Create calendar stick event
export async function POST(request: NextRequest) {
  try {
    const session = await requireADSession(request)
    const body = await request.json()
    const result = await createCalstick(session, body)
    return new Response(JSON.stringify(result.body), { status: result.status })
  } catch (error) {
    return handleApiError(error)
  }
}

// PUT /api/v2/calsticks?id=... - Update calendar stick event
export async function PUT(request: NextRequest) {
  try {
    const session = await requireADSession(request)
    const url = new URL(request.url)
    const eventId = url.searchParams.get('id') || ''
    const body = await request.json()
    const result = await updateCalstick(session, eventId, body)
    return new Response(JSON.stringify(result.body), { status: result.status })
  } catch (error) {
    return handleApiError(error)
  }
}

// DELETE /api/v2/calsticks?id=... - Delete calendar stick event
export async function DELETE(request: NextRequest) {
  try {
    const session = await requireADSession(request)
    const url = new URL(request.url)
    const eventId = url.searchParams.get('id') || ''
    const result = await deleteCalstick(session, eventId)
    return new Response(JSON.stringify(result.body), { status: result.status })
  } catch (error) {
    return handleApiError(error)
  }
}

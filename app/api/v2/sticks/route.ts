// v2 Sticks API: Full CRUD, PostgreSQL + AD
import { NextRequest } from 'next/server'
import { requireADSession } from '@/lib/auth/ad-session'
import { handleApiError } from '@/lib/api/handle-api-error'
import { listSticks, createStick, updateStick, deleteStick } from '@/lib/handlers/sticks-handler'

// GET /api/v2/sticks - List sticks for user/org (owned or shared)
export async function GET(request: NextRequest) {
  try {
    const session = await requireADSession(request)
    const url = new URL(request.url)
    const limit = Number(url.searchParams.get('limit') || '50')
    const offset = Number(url.searchParams.get('offset') || '0')
    const result = await listSticks(session, limit, offset)
    return new Response(JSON.stringify(result.body), { status: result.status })
  } catch (error) {
    return handleApiError(error)
  }
}

// POST /api/v2/sticks - Create stick
export async function POST(request: NextRequest) {
  try {
    const session = await requireADSession(request)
    const body = await request.json()
    const result = await createStick(session, body)
    return new Response(JSON.stringify(result.body), { status: result.status })
  } catch (error) {
    return handleApiError(error)
  }
}

// PUT /api/v2/sticks?id=... - Update stick
export async function PUT(request: NextRequest) {
  try {
    const session = await requireADSession(request)
    const url = new URL(request.url)
    const stickId = url.searchParams.get('id') || ''
    const body = await request.json()
    const result = await updateStick(session, stickId, body)
    return new Response(JSON.stringify(result.body), { status: result.status })
  } catch (error) {
    return handleApiError(error)
  }
}

// DELETE /api/v2/sticks?id=... - Delete stick
export async function DELETE(request: NextRequest) {
  try {
    const session = await requireADSession(request)
    const url = new URL(request.url)
    const stickId = url.searchParams.get('id') || ''
    const result = await deleteStick(session, stickId)
    return new Response(JSON.stringify(result.body), { status: result.status })
  } catch (error) {
    return handleApiError(error)
  }
}

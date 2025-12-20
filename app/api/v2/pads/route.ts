// v2 Pads API: Full CRUD, PostgreSQL + AD
import { NextRequest } from 'next/server'
import { requireADSession } from '@/lib/auth/ad-session'
import { handleApiError } from '@/lib/api/handle-api-error'
import { listPads, createPad, updatePad, deletePad } from '@/lib/handlers/pads-handler'

// GET /api/v2/pads - List pads for user/org (owned or member)
export async function GET(request: NextRequest) {
  try {
    const session = await requireADSession(request)
    const url = new URL(request.url)
    const limit = Number(url.searchParams.get('limit') || '50')
    const offset = Number(url.searchParams.get('offset') || '0')
    const result = await listPads(session, limit, offset)
    return new Response(JSON.stringify(result.body), { status: result.status })
  } catch (error) {
    return handleApiError(error)
  }
}

// POST /api/v2/pads - Create pad
export async function POST(request: NextRequest) {
  try {
    const session = await requireADSession(request)
    const body = await request.json()
    const result = await createPad(session, body)
    return new Response(JSON.stringify(result.body), { status: result.status })
  } catch (error) {
    return handleApiError(error)
  }
}

// PUT /api/v2/pads?id=... - Update pad
export async function PUT(request: NextRequest) {
  try {
    const session = await requireADSession(request)
    const url = new URL(request.url)
    const padId = url.searchParams.get('id') || ''
    const body = await request.json()
    const result = await updatePad(session, padId, body)
    return new Response(JSON.stringify(result.body), { status: result.status })
  } catch (error) {
    return handleApiError(error)
  }
}

// DELETE /api/v2/pads?id=... - Delete pad
export async function DELETE(request: NextRequest) {
  try {
    const session = await requireADSession(request)
    const url = new URL(request.url)
    const padId = url.searchParams.get('id') || ''
    const result = await deletePad(session, padId)
    return new Response(JSON.stringify(result.body), { status: result.status })
  } catch (error) {
    return handleApiError(error)
  }
}

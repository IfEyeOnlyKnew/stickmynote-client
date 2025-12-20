// v2 Quicksticks API route - uses extracted handler for testability
import { NextRequest } from 'next/server'
import { requireADSession } from '@/lib/auth/ad-session'
import { listQuicksticks, createQuickstick } from '@/lib/handlers/quicksticks-handler'

// GET /api/v2/quicksticks - List quicksticks for user/org
export async function GET(request: NextRequest) {
  try {
    const session = await requireADSession(request)
    const result = await listQuicksticks(session)
    return new Response(JSON.stringify(result.body), { status: result.status })
  } catch (error) {
    if (error instanceof Response) return error
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }
}

// POST /api/v2/quicksticks - Create a quickstick
export async function POST(request: NextRequest) {
  try {
    const session = await requireADSession(request)
    const body = await request.json()
    const result = await createQuickstick(session, body)
    return new Response(JSON.stringify(result.body), { status: result.status })
  } catch (error) {
    if (error instanceof Response) return error
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }
}

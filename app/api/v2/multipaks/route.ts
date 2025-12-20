// v2 Multipaks API route - uses extracted handler for testability
import { NextRequest } from 'next/server'
import { requireADSession } from '@/lib/auth/ad-session'
import { listMultipaks, createMultipak } from '@/lib/handlers/multipaks-handler'

// GET /api/v2/multipaks - List multipaks for user/org
export async function GET(request: NextRequest) {
  try {
    const session = await requireADSession(request)
    const result = await listMultipaks(session)
    return new Response(JSON.stringify(result.body), { status: result.status })
  } catch (error) {
    if (error instanceof Response) return error
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }
}

// POST /api/v2/multipaks - Create a multipak
export async function POST(request: NextRequest) {
  try {
    const session = await requireADSession(request)
    const body = await request.json()
    const result = await createMultipak(session, body)
    return new Response(JSON.stringify(result.body), { status: result.status })
  } catch (error) {
    if (error instanceof Response) return error
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }
}

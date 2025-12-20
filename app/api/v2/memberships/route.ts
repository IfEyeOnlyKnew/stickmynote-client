// v2 Memberships API route - uses extracted handler for testability
import { NextRequest } from 'next/server'
import { requireADSession } from '@/lib/auth/ad-session'
import { listMemberships, addMembership } from '@/lib/handlers/memberships-handler'

// GET /api/v2/memberships - List memberships
export async function GET(request: NextRequest) {
  try {
    const session = await requireADSession(request)
    const result = await listMemberships(session)
    return new Response(JSON.stringify(result.body), { status: result.status })
  } catch (error) {
    if (error instanceof Response) return error
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }
}

// POST /api/v2/memberships - Add a membership
export async function POST(request: NextRequest) {
  try {
    const session = await requireADSession(request)
    const body = await request.json()
    const result = await addMembership(session, body)
    return new Response(JSON.stringify(result.body), { status: result.status })
  } catch (error) {
    if (error instanceof Response) return error
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }
}

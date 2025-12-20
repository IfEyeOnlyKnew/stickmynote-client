// v2 Invites API route - uses extracted handler for testability
import { NextRequest } from 'next/server'
import { requireADSession } from '@/lib/auth/ad-session'
import { listInvites, acceptInvite } from '@/lib/handlers/invites-handler'

// GET /api/v2/invites - List invites
export async function GET(request: NextRequest) {
  try {
    const session = await requireADSession(request)
    const result = await listInvites(session)
    return new Response(JSON.stringify(result.body), { status: result.status })
  } catch (error) {
    if (error instanceof Response) return error
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }
}

// POST /api/v2/invites - Accept an invite by token
export async function POST(request: NextRequest) {
  try {
    const session = await requireADSession(request)
    const body = await request.json()
    const result = await acceptInvite(session, body)
    return new Response(JSON.stringify(result.body), { status: result.status })
  } catch (error) {
    if (error instanceof Response) return error
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }
}

// v2 Intake API route - uses extracted handler for testability
import { NextRequest } from 'next/server'
import { requireADSession } from '@/lib/auth/ad-session'
import { listIntakeForms, createIntakeForm } from '@/lib/handlers/intake-handler'

// GET /api/v2/intake - List intake forms
export async function GET(request: NextRequest) {
  const result = await listIntakeForms()
  return new Response(JSON.stringify(result.body), { status: result.status })
}

// POST /api/v2/intake - Submit intake form
export async function POST(request: NextRequest) {
  try {
    const session = await requireADSession(request)
    const body = await request.json()
    const result = await createIntakeForm(session, body)
    return new Response(JSON.stringify(result.body), { status: result.status })
  } catch (error) {
    if (error instanceof Response) return error
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }
}

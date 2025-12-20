// v2 Request-Access API route - uses extracted handler for testability
import { NextRequest } from 'next/server'
import { listAccessRequests, createAccessRequest } from '@/lib/handlers/request-access-handler'

// GET /api/v2/request-access - List access requests
export async function GET(request: NextRequest) {
  const result = await listAccessRequests()
  return new Response(JSON.stringify(result.body), { status: result.status })
}

// POST /api/v2/request-access - Submit access request
export async function POST(request: NextRequest) {
  const body = await request.json()
  const result = await createAccessRequest(body)
  return new Response(JSON.stringify(result.body), { status: result.status })
}

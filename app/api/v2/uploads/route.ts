// v2 Uploads API: production-quality, file metadata only (no storage logic here)
import { NextRequest } from 'next/server'
import { requireADSession } from '@/lib/auth/ad-session'
import { handleApiError } from '@/lib/api/handle-api-error'
import { listUploads, createUpload } from '@/lib/handlers/uploads-handler'

// POST /api/v2/uploads - Register a file upload (metadata)
export async function POST(request: NextRequest) {
  try {
    const session = await requireADSession(request)
    const body = await request.json()
    const result = await createUpload(session, body)
    return new Response(JSON.stringify(result.body), { status: result.status })
  } catch (error) {
    return handleApiError(error)
  }
}

// GET /api/v2/uploads - List uploads for user/org
export async function GET(request: NextRequest) {
  try {
    const session = await requireADSession(request)
    const result = await listUploads(session)
    return new Response(JSON.stringify(result.body), { status: result.status })
  } catch (error) {
    return handleApiError(error)
  }
}

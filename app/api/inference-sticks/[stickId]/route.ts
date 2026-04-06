// v1 Social Sticks [stickId] API: thin wrapper over shared handler
import { NextResponse } from 'next/server'
import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from '@/lib/auth/cached-auth'
import { getOrgContext } from '@/lib/auth/get-org-context'
import { getStickDetail, updateStickDetail, deleteStickDetail } from '@/lib/handlers/inference-sticks-detail-handler'
import { toResponse } from '@/lib/handlers/inference-response'

const LOG_PREFIX = '[InferenceStick]'

async function getAuthContext() {
  const authResult = await getCachedAuthUser()
  if (authResult.rateLimited) return { error: createRateLimitResponse() }
  if (!authResult.user) return { error: createUnauthorizedResponse() }

  let orgContext
  try {
    orgContext = await getOrgContext()
  } catch (err) {
    if (err instanceof Error && err.message === 'RATE_LIMITED') {
      return { error: createRateLimitResponse() }
    }
    throw err
  }

  if (!orgContext) {
    return { error: NextResponse.json({ error: 'Organization context required' }, { status: 401 }) }
  }

  return { context: { user: authResult.user, orgContext } }
}

export async function GET(request: Request, { params }: { params: Promise<{ stickId: string }> }) {
  try {
    const { stickId } = await params
    const auth = await getAuthContext()
    if ('error' in auth) return auth.error

    return toResponse(await getStickDetail(stickId, auth.context))
  } catch (error) {
    console.error(`${LOG_PREFIX} Error fetching:`, error)
    return NextResponse.json({ error: 'Failed to fetch social stick' }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ stickId: string }> }) {
  try {
    const { stickId } = await params
    const auth = await getAuthContext()
    if ('error' in auth) return auth.error

    const updates = await request.json()
    return toResponse(await updateStickDetail(stickId, updates, auth.context))
  } catch (error) {
    console.error(`${LOG_PREFIX} Error updating:`, error)
    return NextResponse.json({ error: 'Failed to update social stick' }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ stickId: string }> }) {
  try {
    const { stickId } = await params
    const auth = await getAuthContext()
    if ('error' in auth) return auth.error

    return toResponse(await deleteStickDetail(stickId, auth.context))
  } catch (error) {
    console.error(`${LOG_PREFIX} Error deleting:`, error)
    return NextResponse.json({ error: 'Failed to delete social stick' }, { status: 500 })
  }
}

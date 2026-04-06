// v1 Social Sticks Replies API: thin wrapper over shared handler
import { NextResponse } from 'next/server'
import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from '@/lib/auth/cached-auth'
import { getOrgContext } from '@/lib/auth/get-org-context'
import { listReplies, createReply, updateReply, deleteReply } from '@/lib/handlers/inference-sticks-replies-handler'
import { toResponse } from '@/lib/handlers/inference-response'

const LOG_PREFIX = '[InferenceStickReplies]'

async function getRequiredAuthContext() {
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

    let orgId: string | undefined
    try {
      const orgContext = await getOrgContext()
      orgId = orgContext?.orgId
    } catch (err) {
      if (err instanceof Error && err.message === 'RATE_LIMITED') {
        return createRateLimitResponse()
      }
    }

    return toResponse(await listReplies(stickId, orgId))
  } catch (error) {
    console.error(`${LOG_PREFIX} Error fetching replies:`, error)
    return NextResponse.json({ error: 'Failed to fetch replies' }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ stickId: string }> }) {
  try {
    const { stickId } = await params
    const auth = await getRequiredAuthContext()
    if ('error' in auth) return auth.error

    const body = await request.json()
    return toResponse(await createReply(stickId, body, auth.context))
  } catch (error) {
    console.error(`${LOG_PREFIX} Error creating reply:`, error)
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: 'Failed to create reply', details: msg }, { status: 500 })
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ stickId: string }> }) {
  try {
    await params
    const auth = await getRequiredAuthContext()
    if ('error' in auth) return auth.error

    const body = await request.json()
    return toResponse(await updateReply(body, auth.context))
  } catch (error) {
    console.error(`${LOG_PREFIX} Error updating reply:`, error)
    return NextResponse.json({ error: 'Failed to update reply' }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ stickId: string }> }) {
  try {
    const { stickId } = await params
    const auth = await getRequiredAuthContext()
    if ('error' in auth) return auth.error

    const { searchParams } = new URL(request.url)
    const replyId = searchParams.get('replyId')

    if (!replyId) {
      return NextResponse.json({ error: 'Reply ID is required' }, { status: 400 })
    }

    return toResponse(await deleteReply(stickId, replyId, auth.context))
  } catch (error) {
    console.error(`${LOG_PREFIX} Error deleting reply:`, error)
    return NextResponse.json({ error: 'Failed to delete reply' }, { status: 500 })
  }
}

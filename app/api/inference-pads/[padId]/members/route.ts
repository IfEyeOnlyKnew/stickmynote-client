// v1 Social Pads Members API: thin wrapper over shared handler
import { NextResponse } from 'next/server'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { getOrgContext, type OrgContext } from '@/lib/auth/get-org-context'
import { listPadMembers, addPadMember, updatePadMember, removePadMember } from '@/lib/handlers/inference-pads-members-handler'
import { toResponse } from '@/lib/handlers/inference-response'

const RATE_LIMIT_HEADERS = { 'Retry-After': '30' }

function rateLimitError(extras: Record<string, unknown> = {}) {
  return NextResponse.json(
    { error: 'Rate limit exceeded. Please try again in a moment.', ...extras },
    { status: 429, headers: RATE_LIMIT_HEADERS }
  )
}

async function getAuthContext() {
  const authResult = await getCachedAuthUser()

  if (authResult.rateLimited) {
    return { error: rateLimitError({ members: [], isOwner: false }) }
  }

  if (!authResult.user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  let orgContext: OrgContext | null = null
  try {
    orgContext = await getOrgContext()
  } catch (orgError) {
    if (orgError instanceof Error && orgError.message === 'RATE_LIMITED') {
      return { error: rateLimitError({ members: [], isOwner: false }) }
    }
    throw orgError
  }

  if (!orgContext) {
    return { error: NextResponse.json({ error: 'Organization context required' }, { status: 401 }) }
  }

  return { context: { user: authResult.user, orgContext } }
}

export async function GET(request: Request, { params }: { params: Promise<{ padId: string }> }) {
  try {
    const { padId } = await params
    const auth = await getAuthContext()
    if ('error' in auth) return auth.error

    return toResponse(await listPadMembers(padId, auth.context))
  } catch (error) {
    console.error('[v0] Error in GET /api/inference-pads/[padId]/members:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch members'
    if (errorMessage === 'RATE_LIMITED' || errorMessage.includes('Too Many')) {
      return rateLimitError({ members: [], isOwner: false })
    }
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ padId: string }> }) {
  try {
    const { padId } = await params
    const auth = await getAuthContext()
    if ('error' in auth) return auth.error

    let body: { email?: string; role?: string }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const { email, role } = body
    if (!email || !role) {
      return NextResponse.json({ error: 'Email and role are required' }, { status: 400 })
    }

    return toResponse(await addPadMember(padId, email, role, auth.context))
  } catch (error) {
    console.error('[v0] Error in POST /api/inference-pads/[padId]/members:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to add member' }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ padId: string }> }) {
  try {
    const { padId } = await params
    const auth = await getAuthContext()
    if ('error' in auth) return auth.error

    let body: { memberId?: string; role?: string; hourlyRateCents?: number }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const result = await updatePadMember(padId, body as any, auth.context)

    // Return validation errors as 400, not 500
    if (result.status === 400 && result.body.error?.includes('Invalid role')) {
      return NextResponse.json({ error: result.body.error }, { status: 400 })
    }

    return toResponse(result)
  } catch (error) {
    console.error('Error updating member:', error)
    const message = error instanceof Error ? error.message : 'Failed to update member'
    if (message.includes('Invalid role')) {
      return NextResponse.json({ error: message }, { status: 400 })
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ padId: string }> }) {
  try {
    const { padId } = await params
    const auth = await getAuthContext()
    if ('error' in auth) return auth.error

    const { searchParams } = new URL(request.url)
    const memberId = searchParams.get('memberId')

    if (!memberId) {
      return NextResponse.json({ error: 'Member ID is required' }, { status: 400 })
    }

    return toResponse(await removePadMember(padId, memberId, auth.context))
  } catch (error) {
    console.error('Error removing member:', error)
    return NextResponse.json({ error: 'Failed to remove member' }, { status: 500 })
  }
}

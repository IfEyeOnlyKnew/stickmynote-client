// v1 Social Pads [padId] API: thin wrapper over shared handler
import { type NextRequest, NextResponse } from 'next/server'
import { getOrgContext } from '@/lib/auth/get-org-context'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { checkDLPPolicy } from '@/lib/dlp/policy-checker'
import { getPadDetail, updatePadDetail } from '@/lib/handlers/inference-pads-handler'
import { toResponse } from '@/lib/handlers/inference-response'

export async function GET(request: NextRequest, { params }: { params: Promise<{ padId: string }> }) {
  try {
    const { padId } = await params

    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again in a moment.' },
        { status: 429, headers: { 'Retry-After': '30' } }
      )
    }

    const user = authResult.user
    const orgContext = user ? await getOrgContext() : null

    return toResponse(await getPadDetail(padId, user, orgContext))
  } catch (error) {
    console.error('Error in GET /api/inference-pads/[padId]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ padId: string }> }) {
  try {
    const { padId } = await params
    const authResult = await getCachedAuthUser()

    if (authResult.rateLimited) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again in a moment.' },
        { status: 429, headers: { 'Retry-After': '30' } }
      )
    }

    if (!authResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = authResult.user

    const orgContext = await getOrgContext()
    if (!orgContext) {
      return NextResponse.json({ error: 'Organization context required' }, { status: 401 })
    }

    const { name, description, is_public } = await request.json()

    // DLP check when making a pad public (v1-specific behavior)
    if (is_public === true) {
      const dlpResult = await checkDLPPolicy({
        orgId: orgContext.orgId,
        action: 'make_pad_public',
        userId: user.id,
      })
      if (!dlpResult.allowed) {
        return NextResponse.json({ error: dlpResult.reason }, { status: 403 })
      }
    }

    return toResponse(await updatePadDetail(padId, { name, description, is_public }, user, orgContext))
  } catch (error) {
    console.error('Error in PATCH /api/inference-pads/[padId]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

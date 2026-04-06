// v1 Social Sticks Bulk Members API: thin wrapper over shared handler
import { NextResponse } from 'next/server'
import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from '@/lib/auth/cached-auth'
import { bulkAddStickMembers } from '@/lib/handlers/inference-sticks-members-handler'
import { toResponse } from '@/lib/handlers/inference-response'

export async function POST(request: Request, { params }: { params: Promise<{ stickId: string }> }) {
  try {
    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) return createRateLimitResponse()
    if (!authResult.user) return createUnauthorizedResponse()

    const { stickId } = await params
    const { emails } = await request.json()

    return toResponse(await bulkAddStickMembers(stickId, emails, authResult.user.id))
  } catch (error) {
    console.error('Error bulk inviting stick members:', error)
    return NextResponse.json({ error: 'Failed to invite members' }, { status: 500 })
  }
}

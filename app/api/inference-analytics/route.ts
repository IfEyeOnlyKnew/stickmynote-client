// v1 Inference Analytics API: thin wrapper over shared handler
import { NextResponse } from 'next/server'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { getOrgContext } from '@/lib/auth/get-org-context'
import { getAnalytics } from '@/lib/handlers/inference-analytics-handler'
import { toResponse } from '@/lib/handlers/inference-response'

export async function GET() {
  try {
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

    const orgContext = await getOrgContext(authResult.user.id)
    if (!orgContext) {
      return NextResponse.json({ error: 'No organization context' }, { status: 403 })
    }

    return toResponse(await getAnalytics(authResult.user, orgContext))
  } catch (error) {
    console.error('Error fetching analytics:', error)
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 })
  }
}

// v2 Calsticks Objectives API: production-quality, manage OKRs
import { type NextRequest } from 'next/server'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { getOrgContext } from '@/lib/auth/get-org-context'
import { handleApiError } from '@/lib/api/handle-api-error'
import { getObjectives, createObjective } from '@/lib/handlers/calsticks-objectives-handler'

export const dynamic = 'force-dynamic'

// GET /api/v2/calsticks/objectives - Get user's objectives
export async function GET() {
  try {
    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }),
        { status: 429, headers: { 'Retry-After': '30' } }
      )
    }
    if (!authResult.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }

    const orgContext = await getOrgContext()
    if (!orgContext) {
      return new Response(JSON.stringify({ error: 'No organization context' }), { status: 403 })
    }

    const objectives = await getObjectives(authResult.user, orgContext)
    return new Response(JSON.stringify(objectives), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

// POST /api/v2/calsticks/objectives - Create new objective
export async function POST(request: NextRequest) {
  try {
    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }),
        { status: 429, headers: { 'Retry-After': '30' } }
      )
    }
    if (!authResult.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }

    const orgContext = await getOrgContext()
    if (!orgContext) {
      return new Response(JSON.stringify({ error: 'No organization context' }), { status: 403 })
    }

    const body = await request.json()
    const objective = await createObjective(authResult.user, orgContext, body)
    return new Response(JSON.stringify(objective), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

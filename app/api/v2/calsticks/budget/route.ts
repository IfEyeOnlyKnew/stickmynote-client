// v2 Calsticks Budget API: production-quality, manage project budgets
import { type NextRequest } from 'next/server'
import { getOrgContext } from '@/lib/auth/get-org-context'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { handleApiError } from '@/lib/api/handle-api-error'
import { getBudgetData, updateBudget } from '@/lib/handlers/calsticks-budget-handler'

export const dynamic = 'force-dynamic'

// GET /api/v2/calsticks/budget - Get project budget data
export async function GET(request: NextRequest) {
  try {
    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) {
      return new Response(JSON.stringify({ error: 'Rate limited' }), {
        status: 429,
        headers: { 'Retry-After': '30' },
      })
    }
    if (!authResult.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }

    const orgContext = await getOrgContext()
    if (!orgContext) {
      return new Response(JSON.stringify({ error: 'No organization context' }), { status: 403 })
    }

    const result = await getBudgetData(authResult.user, orgContext)
    return new Response(JSON.stringify(result), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

// POST /api/v2/calsticks/budget - Update project budget
export async function POST(request: NextRequest) {
  try {
    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) {
      return new Response(JSON.stringify({ error: 'Rate limited' }), {
        status: 429,
        headers: { 'Retry-After': '30' },
      })
    }
    if (!authResult.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }

    const orgContext = await getOrgContext()
    if (!orgContext) {
      return new Response(JSON.stringify({ error: 'No organization context' }), { status: 403 })
    }

    const body = await request.json()
    const result = await updateBudget(orgContext, body)
    return new Response(JSON.stringify(result), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

// v2 Social Sticks Tabs API: production-quality, manage stick tabs
import { type NextRequest } from 'next/server'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { getOrgContext } from '@/lib/auth/get-org-context'
import { handleApiError } from '@/lib/api/handle-api-error'
import { getStickTabs, upsertStickTab, deleteStickTab, deleteStickTabItem } from '@/lib/handlers/inference-sticks-tabs-handler'
import { rateLimitResponse, unauthorizedResponse } from '@/lib/handlers/inference-response'

export const dynamic = 'force-dynamic'

// GET /api/v2/inference-sticks/[stickId]/tabs - Get tabs
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ stickId: string }> }
) {
  try {
    const { stickId } = await params

    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) return rateLimitResponse()
    if (!authResult.user) return unauthorizedResponse()

    const tabs = await getStickTabs(stickId)
    return new Response(JSON.stringify({ tabs }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

// POST /api/v2/inference-sticks/[stickId]/tabs - Create or update tab
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ stickId: string }> }
) {
  try {
    const { stickId } = await params

    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) return rateLimitResponse()
    if (!authResult.user) return unauthorizedResponse()

    const orgContext = await getOrgContext()
    const body = await request.json()

    const tab = await upsertStickTab(stickId, body, orgContext?.orgId)
    return new Response(JSON.stringify({ tab }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

// DELETE /api/v2/inference-sticks/[stickId]/tabs - Delete tab or item
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ stickId: string }> }
) {
  try {
    const { stickId } = await params

    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) return rateLimitResponse()
    if (!authResult.user) return unauthorizedResponse()

    const body = await request.json()
    const { tabId, tabType, itemId } = body

    if (tabId) {
      await deleteStickTab(tabId)
      return new Response(JSON.stringify({ success: true }), { status: 200 })
    }

    if (tabType && itemId) {
      const found = await deleteStickTabItem(stickId, tabType, itemId)
      if (!found) {
        return new Response(JSON.stringify({ error: 'Tab not found' }), { status: 404 })
      }
      return new Response(JSON.stringify({ success: true }), { status: 200 })
    }

    return new Response(
      JSON.stringify({ error: 'Either tabId or both tabType and itemId are required' }),
      { status: 400 }
    )
  } catch (error) {
    return handleApiError(error)
  }
}

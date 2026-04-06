// v2 Muted Items API: production-quality, manage muted notification items
import { type NextRequest } from 'next/server'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { handleApiError } from '@/lib/api/handle-api-error'
import { getMutedItems, muteItem, unmuteItem } from '@/lib/handlers/muted-items-handler'
import { rateLimitResponse, unauthorizedResponse } from '@/lib/handlers/inference-response'

export const dynamic = 'force-dynamic'

// GET /api/v2/muted-items - Get user's muted items
export async function GET(request: NextRequest) {
  try {
    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) return rateLimitResponse()
    if (!authResult.user) return unauthorizedResponse()

    const mutedItems = await getMutedItems(authResult.user.id)
    return new Response(JSON.stringify({ mutedItems }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

// POST /api/v2/muted-items - Mute an item
export async function POST(request: NextRequest) {
  try {
    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) return rateLimitResponse()
    if (!authResult.user) return unauthorizedResponse()

    const body = await request.json()
    const mutedItem = await muteItem(authResult.user.id, body)
    return new Response(JSON.stringify({ mutedItem }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

// DELETE /api/v2/muted-items - Unmute an item
export async function DELETE(request: NextRequest) {
  try {
    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) return rateLimitResponse()
    if (!authResult.user) return unauthorizedResponse()

    const { searchParams } = new URL(request.url)
    const entityType = searchParams.get('entity_type')
    const entityId = searchParams.get('entity_id')

    if (!entityType || !entityId) {
      return new Response(
        JSON.stringify({ error: 'entity_type and entity_id are required' }),
        { status: 400 }
      )
    }

    await unmuteItem(authResult.user.id, entityType, entityId)
    return new Response(JSON.stringify({ success: true }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

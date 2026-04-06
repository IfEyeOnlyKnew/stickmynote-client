// v2 Calsticks Archive API: production-quality, archive/unarchive calsticks
import { type NextRequest } from 'next/server'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { handleApiError } from '@/lib/api/handle-api-error'
import { archiveTasks, unarchiveTask, getArchivedTasks } from '@/lib/handlers/calsticks-archive-handler'

export const dynamic = 'force-dynamic'

// POST /api/v2/calsticks/archive - Archive tasks
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

    const body = await request.json()
    const result = await archiveTasks(authResult.user, body)
    return new Response(JSON.stringify(result), { status: 200 })
  } catch (error: any) {
    if (error?.message === 'No tasks specified') {
      return new Response(JSON.stringify({ error: error.message }), { status: 400 })
    }
    return handleApiError(error)
  }
}

// DELETE /api/v2/calsticks/archive - Unarchive task
export async function DELETE(request: NextRequest) {
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

    const { searchParams } = new URL(request.url)
    const taskId = searchParams.get('taskId')

    if (!taskId) {
      return new Response(JSON.stringify({ error: 'Task ID required' }), { status: 400 })
    }

    const result = await unarchiveTask(authResult.user, taskId)
    return new Response(JSON.stringify(result), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

// GET /api/v2/calsticks/archive - Get archived tasks
export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url)
    const result = await getArchivedTasks(authResult.user, {
      page: Number.parseInt(searchParams.get('page') ?? '1'),
      limit: Number.parseInt(searchParams.get('limit') ?? '20'),
    })
    return new Response(JSON.stringify(result), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

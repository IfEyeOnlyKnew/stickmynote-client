// v1 Social Sticks Members API: thin wrapper over shared handler
import { NextResponse } from 'next/server'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { listStickMembers, addStickMember } from '@/lib/handlers/inference-sticks-members-handler'
import { toResponse } from '@/lib/handlers/inference-response'

async function validateAuth() {
  const authResult = await getCachedAuthUser()

  if (authResult.rateLimited) {
    return {
      error: NextResponse.json(
        { error: 'Rate limit exceeded. Please try again in a moment.' },
        { status: 429, headers: { 'Retry-After': '30' } }
      ),
    }
  }

  if (!authResult.user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  return { user: authResult.user }
}

export async function GET(request: Request, { params }: { params: Promise<{ stickId: string }> }) {
  try {
    const { stickId } = await params
    const auth = await validateAuth()
    if (auth.error) return auth.error

    return toResponse(await listStickMembers(stickId, auth.user.id))
  } catch (error) {
    console.error('Error fetching stick members:', error)
    return NextResponse.json({ error: 'Failed to fetch stick members' }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ stickId: string }> }) {
  try {
    const auth = await validateAuth()
    if (auth.error) return auth.error

    const { email } = await request.json()
    const { stickId } = await params

    return toResponse(await addStickMember(stickId, email, auth.user.id))
  } catch (error) {
    console.error('Error adding stick member:', error)
    return NextResponse.json({ error: 'Failed to add stick member' }, { status: 500 })
  }
}

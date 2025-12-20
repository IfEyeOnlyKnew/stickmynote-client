// Active Directory Session & JWT Management for StickMyNote API Rewrite
import { NextRequest } from 'next/server'
import { getSession } from './local-auth'

export async function requireADSession(request: NextRequest) {
  const session = await getSession()
  if (!session || !session.user) {
    throw new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }
  return session
}

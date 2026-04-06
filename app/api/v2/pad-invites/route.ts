// v2 Pad Invites API: production-quality, invite members to pads
import { type NextRequest } from 'next/server'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { getOrgContext } from '@/lib/auth/get-org-context'
import { handleApiError } from '@/lib/api/handle-api-error'
import {
  VALID_ROLES,
  mapRoleForDatabase,
  createInviteResults,
  fetchPadAndVerifyAccess,
  processUserIdInvites,
  processEmailInvites,
} from '@/lib/handlers/pad-invites-handler'

export const dynamic = 'force-dynamic'

// POST /api/v2/pad-invites - Invite members to a pad
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
    const user = authResult.user

    const orgContext = await getOrgContext()
    if (!orgContext) {
      return new Response(JSON.stringify({ error: 'No organization context' }), { status: 403 })
    }

    const { padId, role, userIds, emails } = await request.json()

    if (!padId || !role) {
      return new Response(JSON.stringify({ error: 'Missing padId or role' }), { status: 400 })
    }

    if (!VALID_ROLES.has(role.toLowerCase())) {
      return new Response(
        JSON.stringify({ error: 'Invalid role. Must be admin, editor, or viewer' }),
        { status: 400 }
      )
    }

    const dbRole = mapRoleForDatabase(role)

    // Fetch pad and verify permissions
    const padCheck = await fetchPadAndVerifyAccess(padId, orgContext.orgId, user.id)
    if (padCheck.error) {
      return new Response(JSON.stringify({ error: padCheck.error }), { status: padCheck.status })
    }

    const results = createInviteResults()
    const inviteContext = {
      padId,
      dbRole,
      orgId: orgContext.orgId,
      inviterId: user.id,
      inviterEmail: user.email || '',
      padName: padCheck.pad.name,
      role,
    }

    if (userIds?.length) {
      await processUserIdInvites(userIds, inviteContext, results)
    }

    if (emails?.length) {
      await processEmailInvites(emails, inviteContext, results)
    }

    results.total = results.success.length + results.failed.length

    return new Response(JSON.stringify({ success: true, summary: results }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

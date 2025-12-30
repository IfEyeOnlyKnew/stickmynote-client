// v2 Organization Note Details API: production-quality, get note by org and note ID
import { NextRequest } from 'next/server'
import { requireADSession } from '@/lib/auth/ad-session'
import { querySingle } from '@/lib/database/pg-helpers'
import { handleApiError } from '@/lib/api/handle-api-error'

// GET /api/v2/organizations/[orgId]/notes/[noteId] - Get note details by org and note ID
export async function GET(request: NextRequest, { params }: { params: Promise<{ orgId: string, noteId: string }> }) {
  try {
    const { orgId, noteId } = await params
    const session = await requireADSession(request)
    // Only allow access if user is a member of the org or admin
    const isMember = session.user.is_admin || session.user.memberships?.some((m: any) => m.organization_id === orgId)
    if (!isMember) {
      return new Response(JSON.stringify({ error: 'Access denied' }), { status: 403 })
    }
    const note = await querySingle(
      `SELECT * FROM notes WHERE id = $1 AND org_id = $2`,
      [noteId, orgId]
    )
    if (!note) return new Response(JSON.stringify({ error: 'Note not found' }), { status: 404 })
    return new Response(JSON.stringify({ note }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

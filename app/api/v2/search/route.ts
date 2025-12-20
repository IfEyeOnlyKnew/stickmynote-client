// v2 Search API: Multi-entity, robust, production-quality
import { NextRequest } from 'next/server'
import { requireADSession } from '@/lib/auth/ad-session'
import { query, count } from '@/lib/database/pg-helpers'
import { handleApiError } from '@/lib/api/handle-api-error'
import { requireOptionalString } from '@/lib/api/validate'

export async function POST(request: NextRequest) {
  try {
    const session = await requireADSession(request)
    const userId = session.user.id
    const orgId = session.user.org_id
    const body = await request.json()
    const q = requireOptionalString(body.q) || ''
    const limit = Math.min(Number(body.limit) || 20, 100)
    const offset = Math.max(Number(body.offset) || 0, 0)
    const entity = body.entity || 'all' // 'notes', 'pads', 'sticks', or 'all'

    const searchTerm = `%${q}%`
    const results: any = {}
    // Notes
    if (entity === 'notes' || entity === 'all') {
      const notes = await query(
        `SELECT * FROM notes WHERE org_id = $1 AND (title ILIKE $2 OR content ILIKE $2) ORDER BY updated_at DESC LIMIT $3 OFFSET $4`,
        [orgId, searchTerm, limit, offset]
      )
      const notesTotal = await count(
        `SELECT COUNT(*) FROM notes WHERE org_id = $1 AND (title ILIKE $2 OR content ILIKE $2)`,
        [orgId, searchTerm]
      )
      results.notes = notes
      results.notesTotal = notesTotal
    }
    // Pads
    if (entity === 'pads' || entity === 'all') {
      const pads = await query(
        `SELECT * FROM pads WHERE org_id = $1 AND (name ILIKE $2 OR description ILIKE $2) ORDER BY updated_at DESC LIMIT $3 OFFSET $4`,
        [orgId, searchTerm, limit, offset]
      )
      const padsTotal = await count(
        `SELECT COUNT(*) FROM pads WHERE org_id = $1 AND (name ILIKE $2 OR description ILIKE $2)`,
        [orgId, searchTerm]
      )
      results.pads = pads
      results.padsTotal = padsTotal
    }
    // Sticks
    if (entity === 'sticks' || entity === 'all') {
      const sticks = await query(
        `SELECT * FROM sticks WHERE org_id = $1 AND (topic ILIKE $2 OR content ILIKE $2) ORDER BY updated_at DESC LIMIT $3 OFFSET $4`,
        [orgId, searchTerm, limit, offset]
      )
      const sticksTotal = await count(
        `SELECT COUNT(*) FROM sticks WHERE org_id = $1 AND (topic ILIKE $2 OR content ILIKE $2)`,
        [orgId, searchTerm]
      )
      results.sticks = sticks
      results.sticksTotal = sticksTotal
    }
    return new Response(JSON.stringify(results), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

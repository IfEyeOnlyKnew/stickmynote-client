// v2 User Memberships API: production-quality
import { NextRequest } from 'next/server'
import { requireADSession } from '@/lib/auth/ad-session'
import { query } from '@/lib/database/pg-helpers'
import { handleApiError } from '@/lib/api/handle-api-error'

// GET /api/v2/user/memberships - Organizations user is a member of with membership details
export async function GET(request: NextRequest) {
  try {
    const session = await requireADSession(request)
    const userId = session.user.id
    
    // Return full membership data including organization details
    const memberships = await query(
      `SELECT 
        m.id,
        m.org_id,
        m.user_id,
        m.role,
        m.invited_by,
        m.invited_at,
        m.joined_at,
        json_build_object(
          'id', o.id,
          'name', o.name,
          'slug', o.slug,
          'type', o.type,
          'settings', o.settings,
          'owner_id', o.owner_id,
          'support_contact_1_email', o.support_contact_1_email,
          'support_contact_1_name', o.support_contact_1_name,
          'support_contact_2_email', o.support_contact_2_email,
          'support_contact_2_name', o.support_contact_2_name,
          'created_at', o.created_at,
          'updated_at', o.updated_at
        ) as organizations
       FROM organization_members m
       JOIN organizations o ON o.id = m.org_id
       WHERE m.user_id = $1
       ORDER BY m.joined_at ASC`,
      [userId]
    )
    return new Response(JSON.stringify({ memberships }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

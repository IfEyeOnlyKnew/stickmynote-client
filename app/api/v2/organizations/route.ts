// v2 Organizations API: CRUD, DN pattern logic, production-quality
import { NextRequest } from 'next/server'
import { requireADSession } from '@/lib/auth/ad-session'
import { query, querySingle } from '@/lib/database/pg-helpers'
import { handleApiError } from '@/lib/api/handle-api-error'
import { requireString, requireId, requireOptionalString } from '@/lib/api/validate'

// GET /api/v2/organizations - List organizations for user
export async function GET(request: NextRequest) {
  try {
    const session = await requireADSession(request)
    const userId = session.user.id
    // List orgs where user is a member
    const orgs = await query(
      `SELECT o.* FROM organizations o
       JOIN organization_members m ON o.id = m.org_id
       WHERE m.user_id = $1
       ORDER BY o.name ASC`,
      [userId]
    )
    return new Response(JSON.stringify({ organizations: orgs }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

// POST /api/v2/organizations - Create organization
export async function POST(request: NextRequest) {
  try {
    const session = await requireADSession(request)
    const userId = session.user.id
    const body = await request.json()
    const name = requireString(body.name, 'name')
    const type = body.type || 'team'
    const dn_patterns = Array.isArray(body.dn_patterns) ? body.dn_patterns : []
    const now = new Date().toISOString()
    
    // Generate slug from name
    const slug = name
      .toLowerCase()
      .replaceAll(/[^a-z0-9]+/g, "-")
      .replaceAll(/^-|-$/g, "") +
      "-" +
      Math.random().toString(36).substring(2, 7)
    
    const org = await querySingle(
      `INSERT INTO organizations (name, slug, type, dn_patterns, settings, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $6) RETURNING *`,
      [name, slug, type, JSON.stringify(dn_patterns), '{}', now]
    )
    // Add creator as owner member
    await query(
      `INSERT INTO organization_members (org_id, user_id, role, joined_at) VALUES ($1, $2, 'owner', $3)`,
      [org.id, userId, now]
    )
    return new Response(JSON.stringify({ organization: org }), { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}

// PUT /api/v2/organizations?id=... - Update org (name, dn_patterns)
export async function PUT(request: NextRequest) {
  try {
    const session = await requireADSession(request)
    const userId = session.user.id
    const url = new URL(request.url)
    const orgId = requireId(url.searchParams.get('id'), 'id')
    const body = await request.json()
    const name = requireOptionalString(body.name)
    const dn_patterns = Array.isArray(body.dn_patterns) ? body.dn_patterns : undefined
    const now = new Date().toISOString()
    // Only allow update if user is admin
    const isAdmin = await querySingle(
      `SELECT 1 FROM organization_members WHERE org_id = $1 AND user_id = $2 AND role = 'admin'`,
      [orgId, userId]
    )
    if (!isAdmin) throw new Error('Not authorized')
    const org = await querySingle(
      `UPDATE organizations SET
        name = COALESCE($1, name),
        dn_patterns = COALESCE($2, dn_patterns),
        updated_at = $3
       WHERE id = $4
       RETURNING *`,
      [name, dn_patterns ? JSON.stringify(dn_patterns) : undefined, now, orgId]
    )
    if (!org) throw new Error('Organization not found')
    return new Response(JSON.stringify({ organization: org }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

// DELETE /api/v2/organizations?id=... - Delete org (admin only)
export async function DELETE(request: NextRequest) {
  try {
    const session = await requireADSession(request)
    const userId = session.user.id
    const url = new URL(request.url)
    const orgId = requireId(url.searchParams.get('id'), 'id')
    // Only allow delete if user is admin
    const isAdmin = await querySingle(
      `SELECT 1 FROM organization_members WHERE org_id = $1 AND user_id = $2 AND role = 'admin'`,
      [orgId, userId]
    )
    if (!isAdmin) throw new Error('Not authorized')
    const deleted = await querySingle(
      'DELETE FROM organizations WHERE id = $1 RETURNING id',
      [orgId]
    )
    if (!deleted) throw new Error('Organization not found')
    return new Response(JSON.stringify({ success: true }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

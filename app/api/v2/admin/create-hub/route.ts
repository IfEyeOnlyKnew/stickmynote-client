// v2 Admin Create Hub API: production-quality, create organization hubs via API
import { db } from '@/lib/database/pg-client'
import { headers } from 'next/headers'
import { handleApiError } from '@/lib/api/handle-api-error'

export const dynamic = 'force-dynamic'

// Admin API key - should be set in environment variables
const ADMIN_API_KEY = process.env.STICKMYNOTE_ADMIN_API_KEY || 'smn-admin-key-change-me'

// POST /api/v2/admin/create-hub - Create an organization hub via API key
export async function POST(request: Request) {
  try {
    const headersList = headers()
    const apiKey = headersList.get('X-Admin-Api-Key')

    // Validate API key
    if (!apiKey || apiKey !== ADMIN_API_KEY) {
      return new Response(JSON.stringify({ error: 'Invalid or missing API key' }), { status: 401 })
    }

    const body = await request.json()
    const { name, description, hub_type, hub_email, home_code, access_mode, is_public, owner_email } =
      body

    // Validate required fields
    if (!name?.trim()) {
      return new Response(JSON.stringify({ error: 'Hub name is required' }), { status: 400 })
    }

    if (!hub_type || !['individual', 'organization'].includes(hub_type)) {
      return new Response(
        JSON.stringify({ error: "hub_type must be 'individual' or 'organization'" }),
        { status: 400 }
      )
    }

    if (!hub_email?.trim()) {
      return new Response(JSON.stringify({ error: 'hub_email is required' }), { status: 400 })
    }

    if (!owner_email?.trim()) {
      return new Response(JSON.stringify({ error: 'owner_email is required' }), { status: 400 })
    }

    // Find owner user by email
    const userResult = await db.query(`SELECT id FROM users WHERE email = $1`, [
      owner_email.trim().toLowerCase(),
    ])

    if (userResult.rows.length === 0) {
      return new Response(
        JSON.stringify({ error: `User not found with email: ${owner_email}` }),
        { status: 404 }
      )
    }

    const ownerId = userResult.rows[0].id

    // Get the user's organization
    const orgResult = await db.query(
      `SELECT om.org_id FROM organization_members om WHERE om.user_id = $1 LIMIT 1`,
      [ownerId]
    )

    if (orgResult.rows.length === 0) {
      return new Response(
        JSON.stringify({ error: 'User does not belong to any organization' }),
        { status: 404 }
      )
    }

    const orgId = orgResult.rows[0].org_id

    // Start transaction
    await db.query('BEGIN')

    try {
      // Insert the hub (social_pad)
      const padResult = await db.query(
        `INSERT INTO social_pads
         (name, description, owner_id, org_id, is_public, hub_type, hub_email, access_mode, home_code)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          name.trim(),
          description?.trim() || null,
          ownerId,
          orgId,
          is_public || false,
          hub_type,
          hub_email.trim(),
          access_mode || 'individual_sticks',
          home_code?.trim() || null,
        ]
      )

      const pad = padResult.rows[0]

      if (!pad) {
        throw new Error('Failed to create hub')
      }

      // Add owner as member with owner admin level
      await db.query(
        `INSERT INTO social_pad_members
         (social_pad_id, user_id, org_id, role, accepted, invited_by, admin_level)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [pad.id, ownerId, orgId, 'editor', true, ownerId, 'owner']
      )

      await db.query('COMMIT')

      return new Response(
        JSON.stringify({
          success: true,
          hub: pad,
          message: `Hub "${name}" created successfully`,
        }),
        { status: 200 }
      )
    } catch (error) {
      await db.query('ROLLBACK')
      throw error
    }
  } catch (error) {
    return handleApiError(error)
  }
}

// GET /api/v2/admin/create-hub - Returns usage information
export async function GET() {
  return new Response(
    JSON.stringify({
      endpoint: '/api/v2/admin/create-hub',
      method: 'POST',
      description: 'Create an organization or individual hub via API',
      headers: {
        'X-Admin-Api-Key': 'Your admin API key (required)',
        'Content-Type': 'application/json',
      },
      body: {
        name: 'string (required) - Hub name',
        hub_type: "'individual' | 'organization' (required)",
        hub_email: 'string (required) - Contact email for the hub',
        owner_email: 'string (required) - Email of the user who will own this hub',
        description: 'string (optional) - Hub description',
        home_code: 'string (optional) - Unique code for the hub',
        access_mode: "'all_sticks' | 'individual_sticks' (optional, default: 'individual_sticks')",
        is_public: 'boolean (optional, default: false)',
      },
      example_powershell: `
$headers = @{
    "X-Admin-Api-Key" = "your-api-key"
    "Content-Type" = "application/json"
}
$body = @{
    name = "Engineering Team Hub"
    hub_type = "organization"
    hub_email = "engineering@company.com"
    owner_email = "admin@company.com"
    description = "Central hub for engineering team"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3001/api/v2/admin/create-hub" -Method POST -Headers $headers -Body $body
    `,
    }),
    { status: 200 }
  )
}

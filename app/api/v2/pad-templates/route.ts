// v2 Pad Templates API: production-quality, manage pad templates
import { type NextRequest } from 'next/server'
import { db } from '@/lib/database/pg-client'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { handleApiError } from '@/lib/api/handle-api-error'

export const dynamic = 'force-dynamic'

// GET /api/v2/pad-templates - Get pad templates
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const hubType = searchParams.get('hub_type')

    let query = `SELECT * FROM paks_pad_templates WHERE 1=1`
    const params: any[] = []
    let paramIndex = 1

    if (category) {
      query += ` AND category = $${paramIndex}`
      params.push(category)
      paramIndex++
    }

    if (hubType) {
      query += ` AND (hub_type = $${paramIndex} OR hub_type IS NULL)`
      params.push(hubType)
      paramIndex++
    }

    query += ` ORDER BY use_count DESC, name`

    const result = await db.query(query, params)
    const templates = result.rows

    // Get categories with counts
    const categories: Record<string, number> = {}
    templates.forEach((template: any) => {
      categories[template.category] = (categories[template.category] || 0) + 1
    })

    return new Response(JSON.stringify({ templates, categories }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

// POST /api/v2/pad-templates - Create a pad template
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

    const body = await request.json()
    const { name, description, category, hub_type, access_mode, initial_sticks, icon_name, color_scheme, is_public } = body

    if (!name || !category) {
      return new Response(
        JSON.stringify({ error: 'Name and category are required' }),
        { status: 400 }
      )
    }

    const result = await db.query(
      `INSERT INTO paks_pad_templates (
        name, description, category, hub_type, access_mode,
        initial_sticks, icon_name, color_scheme, is_public, created_by
      )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        name,
        description,
        category,
        hub_type,
        access_mode || 'individual_sticks',
        initial_sticks ? JSON.stringify(initial_sticks) : '[]',
        icon_name,
        color_scheme,
        is_public || false,
        user.id,
      ]
    )

    return new Response(JSON.stringify({ template: result.rows[0] }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

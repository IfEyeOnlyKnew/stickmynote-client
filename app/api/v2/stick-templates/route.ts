// v2 Stick Templates API: production-quality, manage stick templates
import { type NextRequest } from 'next/server'
import { db } from '@/lib/database/pg-client'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { handleApiError } from '@/lib/api/handle-api-error'

export const dynamic = 'force-dynamic'

// GET /api/v2/stick-templates - Get stick templates
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')

    let query = `SELECT * FROM paks_pad_stick_templates`
    const params: any[] = []

    if (category) {
      query += ` WHERE category = $1`
      params.push(category)
    }

    query += ` ORDER BY category, name`

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

// POST /api/v2/stick-templates - Create a stick template
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
    const { name, description, category, topic_template, content_template, is_public } = body

    if (!name || !category || !content_template) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400 }
      )
    }

    const result = await db.query(
      `INSERT INTO paks_pad_stick_templates (
        name, description, category, topic_template, content_template, is_public, created_by
      )
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [name, description, category, topic_template, content_template, is_public || false, user.id]
    )

    return new Response(JSON.stringify({ template: result.rows[0] }), { status: 200 })
  } catch (error) {
    return handleApiError(error)
  }
}

// Templates handler logic - extracted for testability
import { query, querySingle } from '@/lib/database/pg-helpers'
import { requireString, requireOptionalString } from '@/lib/api/validate'

export interface TemplatesSession {
  user: { id: string; org_id?: string }
}

export interface CreateTemplateInput {
  name: string
  content: string
  description?: string | null
}

// List templates for user/org
export async function listTemplates(session: TemplatesSession) {
  try {
    const templates = await query(
      `SELECT * FROM templates WHERE user_id = $1 AND org_id = $2 ORDER BY created_at DESC`,
      [session.user.id, session.user.org_id]
    )
    return { status: 200, body: { templates } }
  } catch (error) {
    return { status: 500, body: { error: 'Failed to list templates' } }
  }
}

// Create a template
export async function createTemplate(session: TemplatesSession, input: CreateTemplateInput) {
  try {
    const name = requireString(input.name, 'name')
    const content = requireString(input.content, 'content')
    const description = requireOptionalString(input.description)
    const now = new Date().toISOString()
    const template = await querySingle(
      `INSERT INTO templates (user_id, org_id, name, content, description, created_at)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [session.user.id, session.user.org_id, name, content, description, now]
    )
    return { status: 201, body: { template } }
  } catch (error: any) {
    if (error?.message) {
      return { status: 400, body: { error: error.message } }
    }
    return { status: 500, body: { error: 'Failed to create template' } }
  }
}

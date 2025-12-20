// Tags handler logic - extracted for testability
import { query, querySingle } from '@/lib/database/pg-helpers'
import { requireString, requireOptionalString } from '@/lib/api/validate'

export interface TagsSession {
  user: { id: string; org_id?: string }
}

export interface CreateTagInput {
  name: string
  description?: string | null
}

export interface UpdateTagInput {
  name?: string | null
  description?: string | null
}

// List tags for user/org
export async function listTags(session: TagsSession) {
  try {
    const tags = await query(
      `SELECT * FROM tags WHERE user_id = $1 AND org_id = $2 ORDER BY name ASC`,
      [session.user.id, session.user.org_id]
    )
    return { status: 200, body: { tags } }
  } catch (error) {
    return { status: 500, body: { error: 'Failed to list tags' } }
  }
}

// Create a tag
export async function createTag(session: TagsSession, input: CreateTagInput) {
  try {
    const name = requireString(input.name, 'name')
    const description = requireOptionalString(input.description)
    const now = new Date().toISOString()
    const tag = await querySingle(
      `INSERT INTO tags (user_id, org_id, name, description, created_at)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [session.user.id, session.user.org_id, name, description, now]
    )
    return { status: 201, body: { tag } }
  } catch (error: any) {
    if (error?.message) {
      return { status: 400, body: { error: error.message } }
    }
    return { status: 500, body: { error: 'Failed to create tag' } }
  }
}

// Update a tag
export async function updateTag(session: TagsSession, tagId: string, input: UpdateTagInput) {
  try {
    const name = requireOptionalString(input.name)
    const description = requireOptionalString(input.description)
    const tag = await querySingle(
      `UPDATE tags SET
        name = COALESCE($1, name),
        description = COALESCE($2, description)
       WHERE id = $3 AND user_id = $4 AND org_id = $5
       RETURNING *`,
      [name, description, tagId, session.user.id, session.user.org_id]
    )
    if (!tag) {
      return { status: 404, body: { error: 'Tag not found or not owned by user' } }
    }
    return { status: 200, body: { tag } }
  } catch (error) {
    return { status: 500, body: { error: 'Failed to update tag' } }
  }
}

// Delete a tag
export async function deleteTag(session: TagsSession, tagId: string) {
  try {
    const deleted = await querySingle(
      'DELETE FROM tags WHERE id = $1 AND user_id = $2 AND org_id = $3 RETURNING id',
      [tagId, session.user.id, session.user.org_id]
    )
    if (!deleted) {
      return { status: 404, body: { error: 'Tag not found or not owned by user' } }
    }
    return { status: 200, body: { success: true } }
  } catch (error) {
    return { status: 500, body: { error: 'Failed to delete tag' } }
  }
}

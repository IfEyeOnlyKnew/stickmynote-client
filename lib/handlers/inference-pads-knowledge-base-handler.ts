// Inference Pads Knowledge Base handler - shared logic between v1 and v2 API routes
import { db } from '@/lib/database/pg-client'

// ============================================================================
// Helpers
// ============================================================================

/**
 * Attach author info to a KB article.
 */
export async function attachAuthor(article: any): Promise<any> {
  if (article.author_id) {
    const result = await db.query(
      `SELECT id, full_name, email, avatar_url FROM users WHERE id = $1`,
      [article.author_id]
    )
    return { ...article, author: result.rows[0] || null }
  }
  return { ...article, author: null }
}

// ============================================================================
// Core Logic
// ============================================================================

/**
 * Get all KB articles for a pad, with author info.
 */
export async function getKnowledgeBaseArticles(padId: string): Promise<any[]> {
  const result = await db.query(
    `SELECT * FROM social_pad_knowledge_base
     WHERE social_pad_id = $1
     ORDER BY is_pinned DESC NULLS LAST, pin_order ASC NULLS LAST, created_at DESC`,
    [padId]
  )

  return Promise.all(result.rows.map((article: any) => attachAuthor(article)))
}

/**
 * Create a new KB article.
 */
export async function createKnowledgeBaseArticle(
  padId: string,
  userId: string,
  input: { title: string; content: string; category?: string; tags?: string[] }
): Promise<any> {
  const result = await db.query(
    `INSERT INTO social_pad_knowledge_base
     (social_pad_id, title, content, category, tags, author_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [padId, input.title, input.content, input.category || 'general', input.tags || [], userId]
  )

  if (result.rows.length === 0) {
    return null
  }

  return attachAuthor(result.rows[0])
}

/**
 * Update a KB article. Returns the updated article with author, or null if not found.
 */
export async function updateKnowledgeBaseArticle(
  padId: string,
  articleId: string,
  fields: { title?: string; content?: string; category?: string; tags?: string[]; is_pinned?: boolean; pin_order?: number }
): Promise<any | null> {
  const updates: string[] = []
  const values: any[] = []
  let paramIndex = 1

  if (fields.title !== undefined) {
    updates.push(`title = $${paramIndex++}`)
    values.push(fields.title)
  }
  if (fields.content !== undefined) {
    updates.push(`content = $${paramIndex++}`)
    values.push(fields.content)
  }
  if (fields.category !== undefined) {
    updates.push(`category = $${paramIndex++}`)
    values.push(fields.category)
  }
  if (fields.tags !== undefined) {
    updates.push(`tags = $${paramIndex++}`)
    values.push(fields.tags)
  }
  if (fields.is_pinned !== undefined) {
    updates.push(`is_pinned = $${paramIndex++}`)
    values.push(fields.is_pinned)
  }
  if (fields.pin_order !== undefined) {
    updates.push(`pin_order = $${paramIndex++}`)
    values.push(fields.pin_order)
  }

  if (updates.length === 0) {
    return undefined // Signals "no fields to update"
  }

  values.push(articleId, padId)

  const result = await db.query(
    `UPDATE social_pad_knowledge_base
     SET ${updates.join(', ')}, updated_at = NOW()
     WHERE id = $${paramIndex++} AND social_pad_id = $${paramIndex}
     RETURNING *`,
    values
  )

  if (result.rows.length === 0) {
    return null
  }

  return attachAuthor(result.rows[0])
}

/**
 * Delete a KB article.
 */
export async function deleteKnowledgeBaseArticle(padId: string, articleId: string): Promise<void> {
  await db.query(
    `DELETE FROM social_pad_knowledge_base WHERE id = $1 AND social_pad_id = $2`,
    [articleId, padId]
  )
}

// Uploads handler logic - extracted for testability
import { query, querySingle } from '@/lib/database/pg-helpers'
import { requireString, requireOptionalString } from '@/lib/api/validate'

export interface UploadSession {
  user: { id: string; org_id?: string }
}

export interface CreateUploadInput {
  filename: string
  mimetype: string
  size?: number
  description?: string | null
}

// List uploads for user/org
export async function listUploads(session: UploadSession) {
  try {
    const uploads = await query(
      `SELECT * FROM uploads WHERE user_id = $1 AND org_id = $2 ORDER BY created_at DESC`,
      [session.user.id, session.user.org_id]
    )
    return { status: 200, body: { uploads } }
  } catch {
    // Expected - database query may fail safely
    return { status: 500, body: { error: 'Failed to list uploads' } }
  }
}

// Create a new upload (metadata)
export async function createUpload(session: UploadSession, input: CreateUploadInput) {
  try {
    const filename = requireString(input.filename, 'filename')
    const mimetype = requireString(input.mimetype, 'mimetype')
    const size = Number(input.size) || 0
    const description = requireOptionalString(input.description)
    const now = new Date().toISOString()
    const upload = await querySingle(
      `INSERT INTO uploads (user_id, org_id, filename, mimetype, size, description, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [session.user.id, session.user.org_id, filename, mimetype, size, description, now]
    )
    return { status: 201, body: { upload } }
  } catch (error: any) {
    if (error?.message) {
      return { status: 400, body: { error: error.message } }
    }
    return { status: 500, body: { error: 'Failed to create upload' } }
  }
}

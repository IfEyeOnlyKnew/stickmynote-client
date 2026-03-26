import { type NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/database/pg-client"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from "@/lib/auth/cached-auth"
import { checkLibraryPermissions } from "@/lib/library/library-permissions"
import { promises as fs } from "fs"
import path from "path"

/**
 * GET /api/library/[fileId] - Get file metadata
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> },
) {
  try {
    const { fileId } = await params
    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) return createRateLimitResponse()
    if (!authResult.user) return createUnauthorizedResponse()

    const orgContext = await getOrgContext()
    if (!orgContext) {
      return NextResponse.json({ error: "No organization context" }, { status: 403 })
    }

    const result = await db.query(
      `SELECT lf.*, u.full_name as uploader_name, u.avatar_url as uploader_avatar
       FROM library_files lf
       LEFT JOIN users u ON u.id = lf.uploaded_by
       WHERE lf.id = $1 AND lf.org_id = $2`,
      [fileId, orgContext.orgId],
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "File not found" }, { status: 404 })
    }

    const file = result.rows[0]

    // Check permissions
    const perms = await checkLibraryPermissions(authResult.user.id, orgContext.orgId, file.scope_type, file.scope_id)
    if (!perms.allowed || !perms.permissions.includes("view")) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    return NextResponse.json({ file, permissions: perms.permissions })
  } catch (error) {
    console.error("[Library] Get file error:", error)
    return NextResponse.json({ error: "Failed to get file" }, { status: 500 })
  }
}

/**
 * PATCH /api/library/[fileId] - Update file metadata (description, folder)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> },
) {
  try {
    const { fileId } = await params
    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) return createRateLimitResponse()
    if (!authResult.user) return createUnauthorizedResponse()

    const orgContext = await getOrgContext()
    if (!orgContext) {
      return NextResponse.json({ error: "No organization context" }, { status: 403 })
    }

    // Get the file first
    const fileResult = await db.query(
      `SELECT * FROM library_files WHERE id = $1 AND org_id = $2`,
      [fileId, orgContext.orgId],
    )

    if (fileResult.rows.length === 0) {
      return NextResponse.json({ error: "File not found" }, { status: 404 })
    }

    const file = fileResult.rows[0]

    // Check permissions - need delete_own (uploader) or manage (admin/owner)
    const perms = await checkLibraryPermissions(authResult.user.id, orgContext.orgId, file.scope_type, file.scope_id)
    const isUploader = file.uploaded_by === authResult.user.id
    if (!perms.allowed || (!perms.permissions.includes("manage") && !isUploader)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    const body = await request.json()
    const { description, folder } = body

    const updated = await db.query(
      `UPDATE library_files
       SET description = COALESCE($1, description),
           folder = COALESCE($2, folder),
           updated_at = NOW()
       WHERE id = $3 AND org_id = $4
       RETURNING *`,
      [description, folder, fileId, orgContext.orgId],
    )

    return NextResponse.json({ file: updated.rows[0] })
  } catch (error) {
    console.error("[Library] Update file error:", error)
    return NextResponse.json({ error: "Failed to update file" }, { status: 500 })
  }
}

/**
 * DELETE /api/library/[fileId] - Delete a file
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> },
) {
  try {
    const { fileId } = await params
    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) return createRateLimitResponse()
    if (!authResult.user) return createUnauthorizedResponse()

    const orgContext = await getOrgContext()
    if (!orgContext) {
      return NextResponse.json({ error: "No organization context" }, { status: 403 })
    }

    // Get the file first
    const fileResult = await db.query(
      `SELECT * FROM library_files WHERE id = $1 AND org_id = $2`,
      [fileId, orgContext.orgId],
    )

    if (fileResult.rows.length === 0) {
      return NextResponse.json({ error: "File not found" }, { status: 404 })
    }

    const file = fileResult.rows[0]

    // Check permissions
    const perms = await checkLibraryPermissions(authResult.user.id, orgContext.orgId, file.scope_type, file.scope_id)
    const isUploader = file.uploaded_by === authResult.user.id

    if (!perms.allowed) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Need delete_any (admin/owner) or delete_own (uploader only)
    if (!perms.permissions.includes("delete_any") && !(perms.permissions.includes("delete_own") && isUploader)) {
      return NextResponse.json({ error: "You do not have permission to delete this file" }, { status: 403 })
    }

    // Delete physical file
    try {
      const baseDir = process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads")
      const filePath = path.join(baseDir, file.file_path)
      await fs.unlink(filePath)
    } catch (err) {
      console.warn(`[Library] Could not delete physical file: ${file.file_path}`, err)
    }

    // Delete database record
    await db.query(
      `DELETE FROM library_files WHERE id = $1 AND org_id = $2`,
      [fileId, orgContext.orgId],
    )

    console.log(`[Library] File deleted: ${file.file_url} by ${authResult.user.id}`)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[Library] Delete error:", error)
    return NextResponse.json({ error: "Failed to delete file" }, { status: 500 })
  }
}

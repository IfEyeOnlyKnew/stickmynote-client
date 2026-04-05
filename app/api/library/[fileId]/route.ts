import { type NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/database/pg-client"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from "@/lib/auth/cached-auth"
import { checkStickLibraryPermissions } from "@/lib/library/library-permissions"
import { promises as fs } from "node:fs"
import path from "node:path"

/**
 * DELETE /api/library/[fileId] - Delete a file from a stick's folder
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

    const fileResult = await db.query(
      `SELECT * FROM library_files WHERE id = $1 AND org_id = $2`,
      [fileId, orgContext.orgId],
    )

    if (fileResult.rows.length === 0) {
      return NextResponse.json({ error: "File not found" }, { status: 404 })
    }

    const file = fileResult.rows[0]

    // Check permissions on the stick
    const perms = await checkStickLibraryPermissions(
      authResult.user.id, orgContext.orgId, file.scope_id, file.stick_type,
    )

    if (!perms.allowed) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Owner can delete any file, uploader can delete their own
    const isUploader = file.uploaded_by === authResult.user.id
    if (!perms.permissions.includes("delete_any") && !(perms.permissions.includes("delete_own") && isUploader)) {
      return NextResponse.json({ error: "Only the stick owner can delete files" }, { status: 403 })
    }

    // Delete physical file
    try {
      const baseDir = process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads")
      const filePath = path.join(baseDir, file.file_path)
      await fs.unlink(filePath)
    } catch (err) {
      console.warn(`[Library] Could not delete physical file: ${file.file_path}`, err)
    }

    await db.query(
      `DELETE FROM library_files WHERE id = $1 AND org_id = $2`,
      [fileId, orgContext.orgId],
    )

    console.log(`[Library] File deleted from stick ${file.scope_id}: ${file.file_url}`)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[Library] Delete error:", error)
    return NextResponse.json({ error: "Failed to delete file" }, { status: 500 })
  }
}

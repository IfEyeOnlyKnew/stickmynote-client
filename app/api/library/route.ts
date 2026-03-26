import { type NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/database/pg-client"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from "@/lib/auth/cached-auth"
import { checkLibraryPermissions, type LibraryScopeType } from "@/lib/library/library-permissions"
import { localStorage } from "@/lib/storage/local-storage"
import path from "path"
import { randomUUID } from "crypto"
import { promises as fs } from "fs"

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB for library files
const ALLOWED_TYPES = [
  "image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain", "text/csv",
  "application/zip",
  "video/mp4", "video/webm",
  "audio/mpeg", "audio/wav",
]

/**
 * GET /api/library - List files in a library
 * Query params: scopeType, scopeId, folder (optional)
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) return createRateLimitResponse()
    if (!authResult.user) return createUnauthorizedResponse()

    const orgContext = await getOrgContext()
    if (!orgContext) {
      return NextResponse.json({ error: "No organization context" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const scopeType = searchParams.get("scopeType") as LibraryScopeType
    const scopeId = searchParams.get("scopeId")
    const folder = searchParams.get("folder")

    if (!scopeType || !scopeId) {
      return NextResponse.json({ error: "scopeType and scopeId are required" }, { status: 400 })
    }

    // Check permissions
    const perms = await checkLibraryPermissions(authResult.user.id, orgContext.orgId, scopeType, scopeId)
    if (!perms.allowed || !perms.permissions.includes("view")) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Build query
    let query = `
      SELECT lf.*, u.full_name as uploader_name, u.avatar_url as uploader_avatar
      FROM library_files lf
      LEFT JOIN users u ON u.id = lf.uploaded_by
      WHERE lf.org_id = $1 AND lf.scope_type = $2 AND lf.scope_id = $3
    `
    const params: any[] = [orgContext.orgId, scopeType, scopeId]

    if (folder) {
      query += ` AND lf.folder = $${params.length + 1}`
      params.push(folder)
    }

    query += ` ORDER BY lf.created_at DESC`

    const result = await db.query(query, params)

    // Also fetch folders
    const folders = await db.query(
      `SELECT * FROM library_folders
       WHERE org_id = $1 AND scope_type = $2 AND scope_id = $3
       ORDER BY name`,
      [orgContext.orgId, scopeType, scopeId],
    )

    return NextResponse.json({
      files: result.rows,
      folders: folders.rows,
      permissions: perms.permissions,
      role: perms.role,
    })
  } catch (error) {
    console.error("[Library] List error:", error)
    return NextResponse.json({ error: "Failed to list files" }, { status: 500 })
  }
}

/**
 * POST /api/library - Upload a file to a library
 * FormData: file, scopeType, scopeId, folder (optional), description (optional)
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) return createRateLimitResponse()
    if (!authResult.user) return createUnauthorizedResponse()

    const orgContext = await getOrgContext()
    if (!orgContext) {
      return NextResponse.json({ error: "No organization context" }, { status: 403 })
    }

    const formData = await request.formData()
    const file = formData.get("file") as File
    const scopeType = formData.get("scopeType") as LibraryScopeType
    const scopeId = formData.get("scopeId") as string
    const folder = formData.get("folder") as string | null
    const description = formData.get("description") as string | null

    if (!file || !scopeType || !scopeId) {
      return NextResponse.json({ error: "file, scopeType, and scopeId are required" }, { status: 400 })
    }

    // Check permissions
    const perms = await checkLibraryPermissions(authResult.user.id, orgContext.orgId, scopeType, scopeId)
    if (!perms.allowed || !perms.permissions.includes("upload")) {
      return NextResponse.json({ error: "You do not have permission to upload files here" }, { status: 403 })
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File size exceeds 50MB limit" }, { status: 400 })
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: `File type ${file.type} is not allowed` }, { status: 400 })
    }

    // Create storage path: uploads/library/{scopeType}/{scopeId}/{uuid}-{filename}
    const baseDir = process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads")
    const libraryDir = path.join(baseDir, "library", scopeType, scopeId)

    // Ensure directory exists
    await fs.mkdir(libraryDir, { recursive: true })

    // Sanitize and create unique filename
    const sanitizedName = file.name.replace(/[<>:"|?*]/g, "_").replace(/\\/g, "_")
    const uniqueFilename = `${randomUUID()}-${sanitizedName}`
    const filePath = path.join(libraryDir, uniqueFilename)

    // Write file
    const buffer = Buffer.from(await file.arrayBuffer())
    await fs.writeFile(filePath, buffer)

    // Build relative path and URL
    const relativePath = path.relative(baseDir, filePath).replace(/\\/g, "/")
    const fileUrl = `/uploads/${relativePath}`

    // Insert record into database
    const result = await db.query(
      `INSERT INTO library_files
        (org_id, scope_type, scope_id, filename, original_filename, file_path, file_url, mime_type, file_size, uploaded_by, description, folder)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        orgContext.orgId,
        scopeType,
        scopeId,
        uniqueFilename,
        file.name,
        relativePath,
        fileUrl,
        file.type,
        file.size,
        authResult.user.id,
        description,
        folder,
      ],
    )

    console.log(`[Library] File uploaded: ${fileUrl} by ${authResult.user.id} to ${scopeType}/${scopeId}`)

    return NextResponse.json({ file: result.rows[0] }, { status: 201 })
  } catch (error) {
    console.error("[Library] Upload error:", error)
    return NextResponse.json({ error: "Upload failed" }, { status: 500 })
  }
}

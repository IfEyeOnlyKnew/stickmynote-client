import { type NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/database/pg-client"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from "@/lib/auth/cached-auth"
import { checkStickLibraryPermissions, type StickType } from "@/lib/library/library-permissions"
import path from "path"
import { randomUUID } from "crypto"
import { promises as fs } from "fs"

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB
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
 * GET /api/library - List files in a stick's folder
 * Query params: stickId, stickType
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
    const stickId = searchParams.get("stickId")
    const stickType = searchParams.get("stickType") as StickType

    if (!stickId || !stickType) {
      return NextResponse.json({ error: "stickId and stickType are required" }, { status: 400 })
    }

    // Check permissions
    const perms = await checkStickLibraryPermissions(authResult.user.id, orgContext.orgId, stickId, stickType)
    if (!perms.allowed) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    const result = await db.query(
      `SELECT lf.*, u.full_name as uploader_name, u.avatar_url as uploader_avatar
       FROM library_files lf
       LEFT JOIN users u ON u.id = lf.uploaded_by
       WHERE lf.org_id = $1 AND lf.scope_type = 'stick' AND lf.scope_id = $2
       ORDER BY lf.created_at DESC`,
      [orgContext.orgId, stickId],
    )

    return NextResponse.json({
      files: result.rows,
      permissions: perms.permissions,
      role: perms.role,
    })
  } catch (error) {
    console.error("[Library] List error:", error)
    return NextResponse.json({ error: "Failed to list files" }, { status: 500 })
  }
}

/**
 * POST /api/library - Upload a file to a stick's folder
 * FormData: file, stickId, stickType, description (optional)
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
    const stickId = formData.get("stickId") as string
    const stickType = formData.get("stickType") as StickType
    const description = formData.get("description") as string | null

    if (!file || !stickId || !stickType) {
      return NextResponse.json({ error: "file, stickId, and stickType are required" }, { status: 400 })
    }

    // Check permissions - must have upload permission (owner only)
    const perms = await checkStickLibraryPermissions(authResult.user.id, orgContext.orgId, stickId, stickType)
    if (!perms.allowed || !perms.permissions.includes("upload")) {
      return NextResponse.json({ error: "Only the stick owner can upload files" }, { status: 403 })
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File size exceeds 50MB limit" }, { status: 400 })
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: `File type ${file.type} is not allowed` }, { status: 400 })
    }

    // Store under: uploads/library/sticks/{stickId}/{uuid}-{filename}
    const baseDir = process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads")
    const libraryDir = path.join(baseDir, "library", "sticks", stickId)
    await fs.mkdir(libraryDir, { recursive: true })

    const sanitizedName = file.name.replace(/[<>:"|?*]/g, "_").replace(/\\/g, "_")
    const uniqueFilename = `${randomUUID()}-${sanitizedName}`
    const filePath = path.join(libraryDir, uniqueFilename)

    const buffer = Buffer.from(await file.arrayBuffer())
    await fs.writeFile(filePath, buffer)

    const relativePath = path.relative(baseDir, filePath).replace(/\\/g, "/")
    const fileUrl = `/uploads/${relativePath}`

    const result = await db.query(
      `INSERT INTO library_files
        (org_id, scope_type, scope_id, stick_type, filename, original_filename, file_path, file_url, mime_type, file_size, uploaded_by, description)
       VALUES ($1, 'stick', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        orgContext.orgId, stickId, stickType,
        uniqueFilename, file.name, relativePath, fileUrl,
        file.type, file.size, authResult.user.id, description,
      ],
    )

    console.log(`[Library] File uploaded to stick ${stickId}: ${fileUrl}`)

    return NextResponse.json({ file: result.rows[0] }, { status: 201 })
  } catch (error) {
    console.error("[Library] Upload error:", error)
    return NextResponse.json({ error: "Upload failed" }, { status: 500 })
  }
}

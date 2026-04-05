import { type NextRequest, NextResponse } from "next/server"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"
import { localStorage } from "@/lib/storage/local-storage"
import { decryptFileForOrg, isEncryptionEnabled } from "@/lib/encryption"
import { db } from "@/lib/database/pg-client"
import path from "node:path"

export const dynamic = "force-dynamic"

const MIME_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
}

function getContentType(filename: string): string {
  const ext = path.extname(filename).toLowerCase()
  return MIME_TYPES[ext] || "application/octet-stream"
}

/**
 * GET /api/serve-image?path=orgs/{orgId}/images/{filename}
 * Authenticates the user, verifies org membership, reads the file from disk,
 * decrypts if needed, and returns the image.
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429, headers: { "Retry-After": "30" } }
      )
    }
    if (!authResult.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const filePath = searchParams.get("path")

    if (!filePath) {
      return NextResponse.json({ error: "No path provided" }, { status: 400 })
    }

    // Security: reject path traversal
    if (filePath.includes("..") || filePath.includes("\\")) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 })
    }

    // Extract orgId from path pattern: orgs/{orgId}/...
    const orgMatch = /^orgs\/([0-9a-f-]+)\//i.exec(filePath)
    if (!orgMatch) {
      return NextResponse.json({ error: "Invalid file path" }, { status: 400 })
    }

    const orgId = orgMatch[1]

    // Verify user belongs to this organization
    const membership = await db.query(
      `SELECT role FROM organization_members
       WHERE user_id = $1 AND org_id = $2 AND status = 'active'
       LIMIT 1`,
      [authResult.user.id, orgId]
    )
    if (membership.rows.length === 0) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Read the file from local storage
    const fileBuffer = await localStorage.getFile(filePath)
    if (!fileBuffer) {
      return NextResponse.json({ error: "File not found" }, { status: 404 })
    }

    const contentType = getContentType(filePath)
    let responseData: Buffer | ArrayBuffer = fileBuffer

    // Decrypt if encryption is enabled
    if (isEncryptionEnabled()) {
      try {
        const arrBuf = new Uint8Array(fileBuffer).buffer
        const decrypted = await decryptFileForOrg(arrBuf, orgId)
        responseData = decrypted
      } catch {
        // File may not be encrypted — serve as-is
        responseData = fileBuffer
      }
    }

    return new NextResponse(responseData, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=3600",
        "Content-Disposition": "inline",
      },
    })
  } catch (error) {
    console.error("[ServeImage] Error:", error)
    return NextResponse.json({ error: "Failed to serve image" }, { status: 500 })
  }
}

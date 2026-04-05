import { NextResponse } from "next/server"
import { promises as fs } from "node:fs"
import path from "node:path"

const MIME_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".pdf": "application/pdf",
}

/**
 * GET /uploads/[...path]
 *
 * Serves files from the uploads directory.
 * In production, server.js handles this before Next.js.
 * This route is the fallback for dev mode (next dev).
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: segments } = await params
    const relativePath = segments.join("/")

    // Prevent directory traversal (/../ or starting with ../)
    if (segments.includes("..")) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 })
    }

    const uploadsRoot = path.resolve(
      process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads")
    )
    const filePath = path.resolve(uploadsRoot, relativePath)

    // Ensure resolved path is within uploads directory
    if (!filePath.startsWith(uploadsRoot)) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 })
    }

    const fileBuffer = await fs.readFile(filePath)
    const ext = path.extname(filePath).toLowerCase()
    const contentType = MIME_TYPES[ext] || "application/octet-stream"

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      },
    })
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 })
  }
}

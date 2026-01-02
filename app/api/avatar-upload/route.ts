import { type NextRequest, NextResponse } from "next/server"
import { createServiceDatabaseClient } from "@/lib/database/database-adapter"
import { validateCSRFMiddleware } from "@/lib/csrf"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"
import { writeFile, mkdir } from "node:fs/promises"
import path from "node:path"

let sharp: any

const initializeModules = async () => {
  try {
    const sharpModule = await import("sharp")
    sharp = sharpModule.default
  } catch (error_) {
    console.warn("Sharp module not available:", error_)
    sharp = null
  }
}

// Helper to save avatar file locally
async function saveAvatarFile(buffer: Buffer, filename: string, contentType: string): Promise<{ url: string; pathname: string }> {
  // Use local file storage
  const uploadDir = path.join(process.cwd(), "public", "uploads", "avatars")
  await mkdir(uploadDir, { recursive: true })

  const localFilename = filename.replaceAll("/", "-")
  const filePath = path.join(uploadDir, localFilename)

  await writeFile(filePath, buffer)

  // Return URL path for local file
  const url = `/uploads/avatars/${localFilename}`
  return { url, pathname: localFilename }
}

async function optimizeAvatar(file: File): Promise<Buffer> {
  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  if (!sharp) {
    return buffer
  }

  try {
    // Process avatar image with sharp
    let image = sharp(buffer)

    // Avatars should be square and reasonably sized (max 512x512)
    const avatarSize = 512
    image = image.resize(avatarSize, avatarSize, {
      fit: "cover",
      position: "center",
    })

    // Get metadata to determine format
    const metadata = await image.metadata()
    const format = metadata.format

    // Optimize based on format
    if (format === "jpeg" || format === "jpg") {
      image = image.jpeg({ quality: 85, progressive: true })
    } else if (format === "png") {
      image = image.png({ compressionLevel: 9, progressive: true })
    } else if (format === "webp") {
      image = image.webp({ quality: 85 })
    } else {
      // Convert other formats to JPEG
      image = image.jpeg({ quality: 85, progressive: true })
    }

    // Strip EXIF metadata
    image = image.rotate()

    return await image.toBuffer()
  } catch (error_) {
    console.warn("Avatar optimization failed, using original:", error_)
    return buffer
  }
}

export async function POST(request: NextRequest) {
  // Validate CSRF token for avatar upload
  const isCSRFValid = await validateCSRFMiddleware(request)
  if (!isCSRFValid) {
    return NextResponse.json({ error: "Invalid or missing CSRF token" }, { status: 403 })
  }

  await initializeModules()

  try {
    const db = await createServiceDatabaseClient()
    const authResult = await getCachedAuthUser()

    if (authResult.rateLimited) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again in a moment." },
        { status: 429, headers: { "Retry-After": "30" } },
      )
    }

    if (!authResult.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const user = authResult.user

    const formData = await request.formData()
    const file = formData.get("file") as File

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"]
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: "File must be a valid image (JPEG, PNG, WebP, or GIF)" }, { status: 400 })
    }

    // Validate file size (max 2MB before optimization)
    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json({ error: "File size must be less than 2MB" }, { status: 400 })
    }

    const optimizedBuffer = await optimizeAvatar(file)

    // Generate unique filename for avatar
    const timestamp = Date.now()
    const randomId = Math.random().toString(36).substring(2, 8)
    const extension = file.name.split(".").pop() || "jpg"
    const filename = `${user.id}-${timestamp}-${randomId}.${extension}`

    const result = await saveAvatarFile(optimizedBuffer, filename, file.type)

    const { error: updateError } = await db
      .from("users")
      .update({
        avatar_url: result.url,
      })
      .eq("id", user.id)

    if (updateError) {
      // Don't fail the request if database update fails - the file is already uploaded
    }

    return NextResponse.json({
      url: result.url,
      filename: result.pathname,
      size: optimizedBuffer.length,
      originalSize: file.size,
      type: file.type,
      optimized: optimizedBuffer.length < file.size,
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        error: "Upload failed: " + (error.message || "Unknown error"),
      },
      { status: 500 },
    )
  }
}

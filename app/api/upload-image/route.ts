import { type NextRequest, NextResponse } from "next/server"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"
import { writeFile, mkdir } from "fs/promises"
import { existsSync } from "fs"
import path from "path"

const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"]
const MAX_FILE_SIZE = 5 * 1024 * 1024
const MAX_DIMENSION = 2048

async function loadSharp(): Promise<any> {
  try {
    const sharpModule = await import("sharp")
    return sharpModule.default
  } catch (error) {
    console.error("[upload-image] Sharp load error:", error)
    console.log("[upload-image] Sharp not available, EXIF stripping disabled")
    return null
  }
}

function validateFile(file: File | null): string | null {
  if (!file) return "No file provided"
  if (!ALLOWED_TYPES.includes(file.type)) return "File must be a valid image (JPEG, PNG, WebP, or GIF)"
  if (file.size > MAX_FILE_SIZE) return "File size must be less than 5MB"
  return null
}

function applyFormatOptions(image: any, format: string): any {
  const formatHandlers: Record<string, () => any> = {
    jpeg: () => image.jpeg({ quality: 85, progressive: true }),
    jpg: () => image.jpeg({ quality: 85, progressive: true }),
    png: () => image.png({ compressionLevel: 9, progressive: true }),
    webp: () => image.webp({ quality: 85 }),
  }
  return (formatHandlers[format] ?? formatHandlers.jpeg)()
}

function resizeIfNeeded(image: any, width?: number, height?: number): any {
  const needsResize = width && height && (width > MAX_DIMENSION || height > MAX_DIMENSION)
  if (!needsResize) return image
  return image.resize(MAX_DIMENSION, MAX_DIMENSION, { fit: "inside", withoutEnlargement: true })
}

async function optimizeImage(sharp: any, buffer: Buffer): Promise<Buffer> {
  try {
    let image = sharp(buffer)
    const metadata = await image.metadata()
    image = resizeIfNeeded(image, metadata.width, metadata.height)
    image = applyFormatOptions(image, metadata.format ?? "jpeg")
    image = image.rotate()
    return await image.toBuffer()
  } catch (error) {
    console.error("[upload-image] Image optimization error:", error)
    return buffer
  }
}

function generateFilename(userId: string, originalName: string): string {
  const timestamp = Date.now()
  const randomId = Math.random().toString(36).substring(2, 8)
  const extension = originalName.split(".").pop() || "jpg"
  return `${timestamp}-${randomId}.${extension}`
}

// Check if we should use local storage (development) or Vercel Blob (production)
function useLocalStorage(): boolean {
  // Use local storage if BLOB_READ_WRITE_TOKEN is not set
  return !process.env.BLOB_READ_WRITE_TOKEN
}

async function saveToLocalStorage(buffer: Buffer, userId: string, filename: string, contentType: string): Promise<{ url: string; pathname: string }> {
  // Save to public/uploads/user-images/{userId}/
  const uploadsDir = path.join(process.cwd(), "public", "uploads", "user-images", userId)

  // Create directory if it doesn't exist
  if (!existsSync(uploadsDir)) {
    await mkdir(uploadsDir, { recursive: true })
  }

  const filePath = path.join(uploadsDir, filename)
  await writeFile(filePath, buffer)

  // Return URL path relative to public folder
  const url = `/uploads/user-images/${userId}/${filename}`

  return { url, pathname: url }
}

async function saveToVercelBlob(buffer: Buffer, userId: string, filename: string, contentType: string): Promise<{ url: string; pathname: string }> {
  const { put } = await import("@vercel/blob")
  const blobPath = `user-images/${userId}/${filename}`

  const blob = await put(blobPath, new Blob([new Uint8Array(buffer)], { type: contentType }), {
    access: "public",
    contentType: contentType,
  })

  return { url: blob.url, pathname: blob.pathname }
}

export async function POST(request: NextRequest) {
  try {
    const sharp = await loadSharp()

    const { user, error: authError, rateLimited } = await getCachedAuthUser()

    if (rateLimited) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 })
    }
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get("file") as File

    const validationError = validateFile(file)
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const optimizedBuffer = sharp ? await optimizeImage(sharp, buffer) : buffer

    const filename = generateFilename(user.id, file.name)

    // Choose storage based on environment
    const storage = useLocalStorage()
      ? await saveToLocalStorage(optimizedBuffer, user.id, filename, file.type)
      : await saveToVercelBlob(optimizedBuffer, user.id, filename, file.type)

    console.log(`[upload-image] Saved image to ${useLocalStorage() ? 'local storage' : 'Vercel Blob'}: ${storage.url}`)

    return NextResponse.json({
      url: storage.url,
      filename: storage.pathname,
      size: optimizedBuffer.length,
      originalSize: file.size,
      type: file.type,
      optimized: optimizedBuffer.length < file.size,
    })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error("[upload-image] Image upload error:", errorMessage)
    return NextResponse.json({ error: "Upload failed: " + errorMessage }, { status: 500 })
  }
}

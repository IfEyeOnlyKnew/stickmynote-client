import { type NextRequest, NextResponse } from "next/server"
import { createDatabaseClient } from "@/lib/database/database-adapter"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"]
const MAX_FILE_SIZE = 5 * 1024 * 1024
const MAX_DIMENSION = 2048

async function loadSharp(): Promise<any> {
  try {
    const sharpModule = await import("sharp")
    return sharpModule.default
  } catch (error) {
    console.error("[upload-image] Sharp load error:", error)
    console.log("[v0] Sharp not available, EXIF stripping disabled")
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
    console.error("[v0] Image optimization error:", error)
    return buffer
  }
}

function generateFilename(userId: string, originalName: string): string {
  const timestamp = Date.now()
  const randomId = Math.random().toString(36).substring(2, 8)
  const extension = originalName.split(".").pop() || "jpg"
  return `user-images/${userId}/${timestamp}-${randomId}.${extension}`
}

export async function POST(request: NextRequest) {
  try {
    const [{ put }, sharp] = await Promise.all([import("@vercel/blob"), loadSharp()])
    await createDatabaseClient()

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
    const blob = await put(filename, new Blob([new Uint8Array(optimizedBuffer)], { type: file.type }), {
      access: "public",
      contentType: file.type,
    })

    return NextResponse.json({
      url: blob.url,
      filename: blob.pathname,
      size: optimizedBuffer.length,
      originalSize: file.size,
      type: file.type,
      optimized: optimizedBuffer.length < file.size,
    })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error("[v0] Image upload error:", errorMessage)
    return NextResponse.json({ error: "Upload failed: " + errorMessage }, { status: 500 })
  }
}

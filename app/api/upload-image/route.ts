import { type NextRequest, NextResponse } from "next/server"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"
import { writeFile, mkdir } from "node:fs/promises"
import { existsSync } from "node:fs"
import path from "node:path"
import { getUploadDir } from "@/lib/storage/upload-path"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { encryptFileForOrg } from "@/lib/encryption"
import { isOrgFileEncryptionEnabled } from "@/lib/encryption-settings"
import { put } from "@/lib/storage/local-storage"

const ALLOWED_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"])
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
  if (!ALLOWED_TYPES.has(file.type)) return "File must be a valid image (JPEG, PNG, WebP, or GIF)"
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

async function saveToLocalStorage(buffer: Buffer, userId: string, filename: string, contentType: string): Promise<{ url: string; pathname: string }> {
  // Save to UPLOAD_DIR/user-images/{userId}/
  const uploadsDir = path.join(getUploadDir(), "user-images", userId)

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

    // Check if org-level file encryption is enabled
    let orgContext: Awaited<ReturnType<typeof getOrgContext>> | null = null
    try {
      orgContext = await getOrgContext()
    } catch {
      // Continue without encryption if org context unavailable
    }

    const shouldEncrypt =
      orgContext && (await isOrgFileEncryptionEnabled(orgContext.orgId))

    if (shouldEncrypt && orgContext) {
      // Encrypt and store in non-public org-scoped directory
      const arrBuf = new Uint8Array(optimizedBuffer).buffer
      const encrypted = await encryptFileForOrg(arrBuf, orgContext.orgId)
      const orgFilename = filename
      const orgPath = `orgs/${orgContext.orgId}/images/${orgFilename}`

      await put(orgPath, Buffer.from(encrypted), {
        contentType: `application/x-encrypted;original=${file.type}`,
      })

      const proxyUrl = `/api/serve-image?path=${encodeURIComponent(orgPath)}`

      console.log(`[upload-image] Encrypted image saved: ${orgPath}`)

      return NextResponse.json({
        url: proxyUrl,
        filename: orgPath,
        size: optimizedBuffer.length,
        originalSize: file.size,
        type: file.type,
        optimized: optimizedBuffer.length < file.size,
        encrypted: true,
      })
    }

    // Default: save unencrypted to public local storage
    const storage = await saveToLocalStorage(optimizedBuffer, user.id, filename, file.type)

    console.log(`[upload-image] Saved image to local storage: ${storage.url}`)

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

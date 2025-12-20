import { type NextRequest, NextResponse } from "next/server"
import { createDatabaseClient } from "@/lib/database/database-adapter"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

let put: any
let sharp: any

const initializeModules = async () => {
  try {
    const blobModule = await import("@vercel/blob")
    put = blobModule.put
  } catch (error) {
    console.error("[upload-media] Blob module load error:", error)
    console.warn("[v0] @vercel/blob not available")
    put = async () => ({ url: "", pathname: "" })
  }

  try {
    const sharpModule = await import("sharp")
    sharp = sharpModule.default
  } catch (error) {
    console.error("[upload-media] Sharp module load error:", error)
    console.warn("[v0] sharp not available, image optimization disabled")
    sharp = null
  }
}

async function optimizeImage(file: File): Promise<Buffer> {
  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  if (!sharp) {
    return buffer
  }

  try {
    let image = sharp(buffer)
    const metadata = await image.metadata()

    const maxDimension = 2048
    if (metadata.width && metadata.height) {
      if (metadata.width > maxDimension || metadata.height > maxDimension) {
        image = image.resize(maxDimension, maxDimension, {
          fit: "inside",
          withoutEnlargement: true,
        })
      }
    }

    const format = metadata.format
    if (format === "jpeg" || format === "jpg") {
      image = image.jpeg({ quality: 85, progressive: true })
    } else if (format === "png") {
      image = image.png({ compressionLevel: 9, progressive: true })
    } else if (format === "webp") {
      image = image.webp({ quality: 85 })
    } else {
      image = image.jpeg({ quality: 85, progressive: true })
    }

    image = image.rotate()

    return await image.toBuffer()
  } catch (error) {
    console.error("[v0] Image optimization error:", error)
    return buffer
  }
}

export async function POST(request: NextRequest) {
  await initializeModules()

  try {
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
    const type = formData.get("type") as string

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    let allowedTypes: string[] = []
    let maxSize = 0

    if (type === "image") {
      allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"]
      maxSize = 5 * 1024 * 1024
    } else if (type === "video") {
      allowedTypes = ["video/mp4", "video/webm", "video/ogg"]
      maxSize = 50 * 1024 * 1024
    } else if (type === "document") {
      allowedTypes = [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "text/plain",
      ]
      maxSize = 10 * 1024 * 1024
    } else {
      return NextResponse.json({ error: "Invalid file type specified" }, { status: 400 })
    }

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: `File must be a valid ${type}` }, { status: 400 })
    }

    if (file.size > maxSize) {
      return NextResponse.json({ error: `File size must be less than ${maxSize / 1024 / 1024}MB` }, { status: 400 })
    }

    let uploadBuffer: Buffer
    const contentType = file.type

    if (type === "image") {
      uploadBuffer = await optimizeImage(file)
    } else {
      const arrayBuffer = await file.arrayBuffer()
      uploadBuffer = Buffer.from(arrayBuffer)
    }

    const timestamp = Date.now()
    const randomId = Math.random().toString(36).substring(2, 8)
    const extension = file.name.split(".").pop() || "bin"
    const filename = `social-media/${user.id}/${type}s/${timestamp}-${randomId}.${extension}`

    const blob = await put(filename, uploadBuffer, {
      access: "public",
      contentType,
    })

    return NextResponse.json({
      url: blob.url,
      filename: blob.pathname,
      size: uploadBuffer.length,
      originalSize: file.size,
      type: file.type,
      mediaType: type,
      optimized: type === "image" ? uploadBuffer.length < file.size : false,
    })
  } catch (error: any) {
    console.error("[v0] Media upload error:", error)
    return NextResponse.json(
      {
        error: "Upload failed: " + (error.message || "Unknown error"),
      },
      { status: 500 },
    )
  }
}

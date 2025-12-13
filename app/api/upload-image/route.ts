import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

export async function POST(request: NextRequest) {
  try {
    const { put } = await import("@vercel/blob")

    let sharp: any = null
    try {
      const sharpModule = await import("sharp")
      sharp = sharpModule.default
    } catch (error) {
      console.log("[v0] Sharp not available, EXIF stripping disabled")
    }

    const supabase = await createClient()

    const { user, error: authError, rateLimited } = await getCachedAuthUser(supabase)

    if (rateLimited) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 })
    }

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get("file") as File

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"]
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: "File must be a valid image (JPEG, PNG, WebP, or GIF)" }, { status: 400 })
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "File size must be less than 5MB" }, { status: 400 })
    }

    let optimizedBuffer: Buffer

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    if (sharp) {
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

        optimizedBuffer = await image.toBuffer()
      } catch (error) {
        console.error("[v0] Image optimization error:", error)
        optimizedBuffer = buffer
      }
    } else {
      optimizedBuffer = buffer
    }

    const timestamp = Date.now()
    const randomId = Math.random().toString(36).substring(2, 8)
    const extension = file.name.split(".").pop() || "jpg"
    const filename = `user-images/${user.id}/${timestamp}-${randomId}.${extension}`

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

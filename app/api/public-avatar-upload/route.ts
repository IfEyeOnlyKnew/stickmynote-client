import { type NextRequest, NextResponse } from "next/server"
import { put } from "@vercel/blob"

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") || ""

    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json({ error: "Content-Type must be multipart/form-data" }, { status: 400 })
    }

    let file: File | null = null

    try {
      const formData = await request.formData()
      file = formData.get("file") as File | null
    } catch (parseError) {
      console.error("[v0] FormData parse error:", parseError)
      return NextResponse.json({ error: "Failed to parse form data. Please try again." }, { status: 400 })
    }

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"]
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: "File must be a valid image (JPEG, PNG, WebP, or GIF)" }, { status: 400 })
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "File size must be less than 5MB" }, { status: 400 })
    }

    // Generate unique filename for avatar
    const timestamp = Date.now()
    const randomId = Math.random().toString(36).substring(2, 8)
    const extension = file.name.split(".").pop() || "jpg"
    const filename = `avatars/signup/${timestamp}-${randomId}.${extension}`

    const arrayBuffer = await file.arrayBuffer()

    // Upload to Vercel Blob
    const blob = await put(filename, arrayBuffer, {
      access: "public",
      contentType: file.type,
    })

    console.log("[v0] Avatar uploaded successfully:", blob.url)

    return NextResponse.json({
      url: blob.url,
      filename: blob.pathname,
      size: file.size,
    })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    console.error("[v0] Public avatar upload error:", errorMessage)
    return NextResponse.json({ error: "Upload failed: " + errorMessage }, { status: 500 })
  }
}

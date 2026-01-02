import { type NextRequest, NextResponse } from "next/server"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"
import { put } from "@/lib/storage/local-storage"

export async function POST(request: NextRequest) {

  try {
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
    const allowedTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "text/plain",
      "text/csv",
      "application/zip",
      "application/x-zip-compressed",
    ]

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: "File type not supported" }, { status: 400 })
    }

    // Validate file size (max 25MB)
    if (file.size > 25 * 1024 * 1024) {
      return NextResponse.json({ error: "File size must be less than 25MB" }, { status: 400 })
    }

    // Get file type from extension or MIME type
    const getFileType = (): string => {
      const extension = file.name.split(".").pop()?.toLowerCase()
      if (extension) {
        if (["pdf"].includes(extension)) return "pdf"
        if (["doc", "docx"].includes(extension)) return "doc"
        if (["xls", "xlsx"].includes(extension)) return "xls"
        if (["ppt", "pptx"].includes(extension)) return "ppt"
        if (["txt"].includes(extension)) return "txt"
        if (["csv"].includes(extension)) return "csv"
        if (["zip"].includes(extension)) return "zip"
      }
      return "pdf"
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Generate unique filename
    const timestamp = Date.now()
    const randomId = Math.random().toString(36).substring(2, 8)
    const extension = file.name.split(".").pop() || "bin"
    const filename = `calstick-attachments/${user.id}/${timestamp}-${randomId}.${extension}`

    // Upload to local storage
    const blob = await put(filename, buffer, {
      folder: "documents",
    })

    return NextResponse.json({
      url: blob.url,
      filename: blob.pathname,
      name: file.name,
      size: file.size,
      type: getFileType(),
    })
  } catch (error: any) {
    return NextResponse.json({ error: "Upload failed: " + (error.message || "Unknown error") }, { status: 500 })
  }
}

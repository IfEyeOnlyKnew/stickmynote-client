import { type NextRequest, NextResponse } from "next/server"
import { put, del } from "@/lib/storage/local-storage"
import { createDatabaseClient } from "@/lib/database/database-adapter"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { encryptFileForOrg, getOrgPrefixedPath, isEncryptionEnabled } from "@/lib/encryption"
import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from "@/lib/auth/cached-auth"

async function getOrgContextSafe() {
  try {
    return await getOrgContext()
  } catch (err) {
    if (err instanceof Error && err.message === "RATE_LIMITED") {
      return null
    }
    throw err
  }
}

export async function POST(request: NextRequest) {
  try {
    await createDatabaseClient()
    const authResult = await getCachedAuthUser()

    if (authResult.rateLimited) {
      return createRateLimitResponse()
    }

    if (!authResult.user) {
      return createUnauthorizedResponse()
    }

    // Get organization context for tenant isolation
    const orgContext = await getOrgContextSafe()
    if (!orgContext) {
      return NextResponse.json({ error: "No organization context found" }, { status: 403 })
    }

    const formData = await request.formData()
    const file = formData.get("file") as File
    formData.get("type") // "avatar", "attachment", "media"
    const noEncrypt = formData.get("noEncrypt") === "true"

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    // Validate file size (10MB max)
    const MAX_SIZE = 10 * 1024 * 1024
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "File size exceeds 10MB limit" }, { status: 400 })
    }

    // Validate file type
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "application/pdf",
      "video/mp4",
      "video/webm",
    ]
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: "File type not allowed" }, { status: 400 })
    }

    const orgPrefixedPath = getOrgPrefixedPath(orgContext.orgId, file.name)

    let uploadData: ArrayBuffer
    let contentType = file.type

    if (isEncryptionEnabled() && !noEncrypt) {
      const fileBuffer = await file.arrayBuffer()
      uploadData = await encryptFileForOrg(fileBuffer, orgContext.orgId)
      // Mark as encrypted in content type for later decryption
      contentType = `application/x-encrypted;original=${file.type}`
    } else {
      uploadData = await file.arrayBuffer()
    }

    // Upload to Vercel Blob with org-prefixed path
    const blob = await put(orgPrefixedPath, uploadData, {
      access: "public",
      contentType,
      addRandomSuffix: false,
    })

    // Log upload for audit trail
    console.log(`[Upload] File uploaded: ${orgPrefixedPath} for org: ${orgContext.orgId}`)

    return NextResponse.json({
      url: blob.url,
      pathname: blob.pathname,
      contentType: file.type,
      size: file.size,
      encrypted: isEncryptionEnabled() && !noEncrypt,
    })
  } catch (error) {
    console.error("[Upload] Error:", error)
    return NextResponse.json({ error: "Upload failed" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await createDatabaseClient()
    const authResult = await getCachedAuthUser()

    if (authResult.rateLimited) {
      return createRateLimitResponse()
    }

    if (!authResult.user) {
      return createUnauthorizedResponse()
    }

    // Get organization context for tenant isolation
    const orgContext = await getOrgContextSafe()
    if (!orgContext) {
      return NextResponse.json({ error: "No organization context found" }, { status: 403 })
    }

    const { url } = await request.json()

    if (!url) {
      return NextResponse.json({ error: "No URL provided" }, { status: 400 })
    }

    const urlPath = new URL(url).pathname
    if (!urlPath.includes(`/orgs/${orgContext.orgId}/`)) {
      return NextResponse.json({ error: "Access denied - file belongs to different organization" }, { status: 403 })
    }

    await del(url)

    console.log(`[Upload] File deleted: ${url} for org: ${orgContext.orgId}`)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[Upload] Delete error:", error)
    return NextResponse.json({ error: "Delete failed" }, { status: 500 })
  }
}

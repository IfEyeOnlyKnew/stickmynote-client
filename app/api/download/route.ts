import { type NextRequest, NextResponse } from "next/server"
import { createDatabaseClient } from "@/lib/database/database-adapter"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { decryptFileForOrg, isEncryptionEnabled } from "@/lib/encryption"

export async function GET(request: NextRequest) {
  try {
    await createDatabaseClient()
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

    // Get organization context for tenant isolation
    const orgContext = await getOrgContext(user.id)
    if (!orgContext) {
      return NextResponse.json({ error: "No organization context found" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const fileUrl = searchParams.get("url")

    if (!fileUrl) {
      return NextResponse.json({ error: "No URL provided" }, { status: 400 })
    }

    const urlPath = new URL(fileUrl).pathname
    if (!urlPath.includes(`/orgs/${orgContext.orgId}/`)) {
      return NextResponse.json({ error: "Access denied - file belongs to different organization" }, { status: 403 })
    }

    // Fetch the file
    const response = await fetch(fileUrl)
    if (!response.ok) {
      return NextResponse.json({ error: "File not found" }, { status: 404 })
    }

    const contentType = response.headers.get("content-type") || ""
    let fileData = await response.arrayBuffer()
    let finalContentType = contentType

    if (contentType.startsWith("application/x-encrypted") && isEncryptionEnabled()) {
      fileData = await decryptFileForOrg(fileData, orgContext.orgId)
      // Extract original content type
      const match = contentType.match(/original=([^;]+)/)
      finalContentType = match ? match[1] : "application/octet-stream"
    }

    return new NextResponse(fileData, {
      headers: {
        "Content-Type": finalContentType,
        "Cache-Control": "private, max-age=3600",
      },
    })
  } catch (error) {
    console.error("[Download] Error:", error)
    return NextResponse.json({ error: "Download failed" }, { status: 500 })
  }
}

import { type NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api/route-helpers"
import {
  bulkDeleteSavedEmails,
  bulkAddSavedEmails,
  parseCSVEmails,
  validateAndParseEmails,
} from "@/lib/handlers/saved-emails-handler"

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAuth()
    if ("response" in auth) return auth.response

    const body = await request.json()
    const { emailIds, teamId } = body

    const result = await bulkDeleteSavedEmails(auth.user, emailIds, teamId)
    return NextResponse.json(result)
  } catch (error: any) {
    if (error?.message === "Invalid email IDs array") {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    console.error("Bulk delete saved emails API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth()
    if ("response" in auth) return auth.response
    const user = auth.user

    const contentType = request.headers.get("content-type")
    const uploadType = request.headers.get("x-upload-type")
    const isFormDataRequest = contentType?.includes("multipart/form-data") || uploadType === "csv-file"

    if (isFormDataRequest) {
      let formData: FormData
      try {
        formData = await request.formData()
      } catch {
        return NextResponse.json(
          { error: "Failed to parse file upload. Please ensure you're uploading a valid CSV file." },
          { status: 400 },
        )
      }

      const file = formData.get("file") as File
      if (!file) {
        return NextResponse.json({ error: "No CSV file provided" }, { status: 400 })
      }

      let parsedEmails: { email: string; name: string | null }[]
      try {
        parsedEmails = await parseCSVEmails(file)
      } catch (err) {
        return NextResponse.json({ error: (err as Error).message }, { status: 400 })
      }

      const result = await bulkAddSavedEmails(user, parsedEmails, "csv")
      return NextResponse.json({ success: true, ...result })
    }

    // JSON bulk add
    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON format. For CSV uploads, please use the file upload feature." },
        { status: 400 },
      )
    }

    const { emails } = body
    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return NextResponse.json({ error: "Invalid emails array" }, { status: 400 })
    }

    const validEmails = validateAndParseEmails(emails)
    if (validEmails.length === 0) {
      return NextResponse.json({ error: "No valid emails provided" }, { status: 400 })
    }

    const result = await bulkAddSavedEmails(user, validEmails, "bulk")
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    console.error("[saved-emails/bulk POST] error:", error)
    return NextResponse.json(
      { error: "Internal server error. Please try again or contact support if the problem persists." },
      { status: 500 },
    )
  }
}

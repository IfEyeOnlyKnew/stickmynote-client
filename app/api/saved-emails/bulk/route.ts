import { type NextRequest, NextResponse } from "next/server"
import { createServiceDatabaseClient } from "@/lib/database/database-adapter"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

export async function DELETE(request: NextRequest) {
  try {
    const db = await createServiceDatabaseClient()

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

    const body = await request.json()
    const { emailIds, teamId } = body

    if (!emailIds || !Array.isArray(emailIds) || emailIds.length === 0) {
      return NextResponse.json({ error: "Invalid email IDs array" }, { status: 400 })
    }

    let query = db.from("saved_emails").delete().eq("user_id", user.id).in("id", emailIds)

    if (teamId) {
      query = query.eq("team_id", teamId)
    }

    const { error } = await query

    if (error) {
      console.error("Error bulk deleting saved emails:", error)
      return NextResponse.json({ error: "Failed to delete emails" }, { status: 500 })
    }

    return NextResponse.json({ success: true, deletedCount: emailIds.length })
  } catch (error) {
    console.error("Bulk delete saved emails API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

async function parseCSVEmails(request: NextRequest): Promise<{ email: string; name: string | null }[]> {
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    throw new Error("Failed to parse file upload. Please ensure you're uploading a valid CSV file.")
  }

  const file = formData.get("file") as File
  if (!file) throw new Error("No CSV file provided")

  let fileText: string
  try {
    fileText = await file.text()
  } catch {
    throw new Error("Failed to read CSV file content. Please ensure the file is not corrupted.")
  }

  if (!fileText.trim()) throw new Error("CSV file is empty")

  const lines = fileText.split(/\r?\n/).filter((line) => line.trim())
  if (lines.length === 0) throw new Error("No valid lines found in CSV file")

  const emails = lines
    .map((line) => {
      const trimmedLine = line.trim().replaceAll(/^["']|["']$/g, "")
      if (trimmedLine.includes(",")) {
        const [email, name] = trimmedLine.split(",").map((s) => s.trim().replaceAll(/^["']|["']$/g, ""))
        return { email: email?.toLowerCase(), name: name || null }
      }
      return { email: trimmedLine.toLowerCase(), name: null }
    })
    .filter((item) => item.email && EMAIL_REGEX.test(item.email))

  if (emails.length === 0) {
    throw new Error("No valid email addresses found in CSV file. Please check the format.")
  }

  return emails as { email: string; name: string | null }[]
}

function parseJSONEmails(emails: any[]): { email: string; name: string | null }[] {
  const validEmails = emails.filter((emailItem) => {
    const email = typeof emailItem === "string" ? emailItem : emailItem.email
    return email && EMAIL_REGEX.test(email)
  })

  return validEmails.map((emailItem) => {
    const email = typeof emailItem === "string" ? emailItem : emailItem.email
    const name = typeof emailItem === "object" && emailItem.name ? emailItem.name : null
    return { email: email.toLowerCase().trim(), name }
  })
}

async function deduplicateAndInsert(
  db: any,
  userId: string,
  emailsToInsert: { user_id: string; team_id: null; email: string; name: string | null; source: string }[],
): Promise<NextResponse> {
  const { data: existingEmails } = await db
    .from("saved_emails")
    .select("email")
    .eq("user_id", userId)
    .is("team_id", null)
    .in("email", emailsToInsert.map((e) => e.email))

  const existingEmailSet = new Set(existingEmails?.map((e: any) => e.email) || [])
  const newEmails = emailsToInsert.filter((e) => !existingEmailSet.has(e.email))
  const duplicateCount = emailsToInsert.length - newEmails.length

  if (newEmails.length === 0) {
    return NextResponse.json({ success: true, added: 0, skipped: duplicateCount, message: "All emails already exist" })
  }

  const { data: insertedEmails, error: insertError } = await db
    .from("saved_emails")
    .insert(newEmails)
    .select()

  if (insertError) {
    console.error("[v0] Bulk saved emails API - Database error:", insertError)
    return NextResponse.json({ error: "Failed to save emails to database. Please try again." }, { status: 500 })
  }

  return NextResponse.json({ success: true, added: insertedEmails?.length || 0, skipped: duplicateCount })
}

export async function POST(request: NextRequest) {
  try {
    const db = await createServiceDatabaseClient()

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

    const contentType = request.headers.get("content-type")
    const uploadType = request.headers.get("x-upload-type")
    const isFormDataRequest = contentType?.includes("multipart/form-data") || uploadType === "csv-file"

    if (isFormDataRequest) {
      let parsedEmails: { email: string; name: string | null }[]
      try {
        parsedEmails = await parseCSVEmails(request)
      } catch (err) {
        return NextResponse.json({ error: (err as Error).message }, { status: 400 })
      }

      const emailsToInsert = parsedEmails.map((e) => ({
        user_id: user.id, team_id: null as null, email: e.email, name: e.name, source: "csv",
      }))

      return deduplicateAndInsert(db, user.id, emailsToInsert)
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

    const validEmails = parseJSONEmails(emails)
    if (validEmails.length === 0) {
      return NextResponse.json({ error: "No valid emails provided" }, { status: 400 })
    }

    const emailsToInsert = validEmails.map((e) => ({
      user_id: user.id, team_id: null as null, email: e.email, name: e.name, source: "bulk",
    }))

    return deduplicateAndInsert(db, user.id, emailsToInsert)
  } catch (error) {
    console.error("[v0] Bulk saved emails API - Unexpected error:", error)
    return NextResponse.json(
      { error: "Internal server error. Please try again or contact support if the problem persists." },
      { status: 500 },
    )
  }
}

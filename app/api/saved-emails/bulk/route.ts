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

export async function POST(request: NextRequest) {
  try {
    console.log("[v0] Bulk saved emails API - POST request started")

    const contentType = request.headers.get("content-type")
    const uploadType = request.headers.get("x-upload-type")
    console.log("[v0] Bulk saved emails API - Content type:", contentType)
    console.log("[v0] Bulk saved emails API - Upload type header:", uploadType)

    const db = await createServiceDatabaseClient()

    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again in a moment." },
        { status: 429, headers: { "Retry-After": "30" } },
      )
    }
    if (!authResult.user) {
      console.error("[v0] Bulk saved emails API - Auth error:", authResult.error)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const user = authResult.user

    console.log("[v0] Bulk saved emails API - User authenticated:", user.email)

    const isFormDataRequest = contentType?.includes("multipart/form-data") || uploadType === "csv-file"

    if (isFormDataRequest) {
      console.log("[v0] Bulk saved emails API - Processing CSV file upload via FormData")

      let formData: FormData
      try {
        formData = await request.formData()
        console.log("[v0] Bulk saved emails API - Successfully parsed FormData")
      } catch (formDataError) {
        console.error("[v0] Bulk saved emails API - FormData parsing failed:", formDataError)
        return NextResponse.json(
          {
            error: "Failed to parse file upload. Please ensure you're uploading a valid CSV file.",
          },
          { status: 400 },
        )
      }

      const file = formData.get("file") as File
      if (!file) {
        console.error("[v0] Bulk saved emails API - No file provided in FormData")
        return NextResponse.json({ error: "No CSV file provided" }, { status: 400 })
      }

      console.log("[v0] Bulk saved emails API - Processing file:", file.name, "size:", file.size, "type:", file.type)

      let fileText: string
      try {
        fileText = await file.text()
        console.log("[v0] Bulk saved emails API - File text length:", fileText.length)
      } catch (fileError) {
        console.error("[v0] Bulk saved emails API - Failed to read file content:", fileError)
        return NextResponse.json(
          {
            error: "Failed to read CSV file content. Please ensure the file is not corrupted.",
          },
          { status: 400 },
        )
      }

      if (!fileText.trim()) {
        console.error("[v0] Bulk saved emails API - Empty CSV file")
        return NextResponse.json({ error: "CSV file is empty" }, { status: 400 })
      }

      const lines = fileText.split(/\r?\n/).filter((line) => line.trim())
      console.log("[v0] Bulk saved emails API - Found", lines.length, "non-empty lines")

      if (lines.length === 0) {
        return NextResponse.json({ error: "No valid lines found in CSV file" }, { status: 400 })
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      const emails = lines
        .map((line, index) => {
          const trimmedLine = line.trim().replace(/^["']|["']$/g, "") // Remove quotes

          if (trimmedLine.includes(",")) {
            const [email, name] = trimmedLine.split(",").map((s) => s.trim().replace(/^["']|["']$/g, ""))
            return { email: email?.toLowerCase(), name: name || null, lineNumber: index + 1 }
          } else {
            return { email: trimmedLine.toLowerCase(), name: null, lineNumber: index + 1 }
          }
        })
        .filter((item) => {
          const isValid = item.email && emailRegex.test(item.email)
          if (!isValid) {
            console.log("[v0] Bulk saved emails API - Invalid email on line", item.lineNumber, ":", item.email)
          }
          return isValid
        })

      console.log("[v0] Bulk saved emails API - Valid emails from CSV:", emails.length)

      if (emails.length === 0) {
        return NextResponse.json(
          {
            error: "No valid email addresses found in CSV file. Please check the format.",
          },
          { status: 400 },
        )
      }

      const emailsToInsert = emails.map((emailData) => ({
        user_id: user.id,
        team_id: null,
        email: emailData.email,
        name: emailData.name,
        source: "csv",
      }))

      try {
        // Check for existing emails
        const { data: existingEmails } = await db
          .from("saved_emails")
          .select("email")
          .eq("user_id", user.id)
          .is("team_id", null)
          .in(
            "email",
            emailsToInsert.map((e) => e.email),
          )

        const existingEmailSet = new Set(existingEmails?.map((e) => e.email) || [])
        const newEmails = emailsToInsert.filter((e) => !existingEmailSet.has(e.email))
        const duplicateCount = emailsToInsert.length - newEmails.length

        console.log("[v0] Bulk saved emails API - Found", duplicateCount, "duplicates,", newEmails.length, "new emails")

        if (newEmails.length === 0) {
          return NextResponse.json({
            success: true,
            added: 0,
            skipped: duplicateCount,
            message: "All emails already exist in your saved list",
          })
        }

        // Insert new emails
        const { data: insertedEmails, error: insertError } = await db
          .from("saved_emails")
          .insert(newEmails)
          .select()

        if (insertError) {
          console.error("[v0] Bulk saved emails API - Database error:", insertError)
          return NextResponse.json(
            {
              error: "Failed to save emails to database. Please try again.",
            },
            { status: 500 },
          )
        }

        console.log("[v0] Bulk saved emails API - Successfully saved", insertedEmails?.length || 0, "emails")

        return NextResponse.json({
          success: true,
          added: insertedEmails?.length || 0,
          skipped: duplicateCount,
        })
      } catch (dbError) {
        console.error("[v0] Bulk saved emails API - Database operation failed:", dbError)
        return NextResponse.json(
          {
            error: "Database operation failed. Please try again.",
          },
          { status: 500 },
        )
      }
    } else {
      console.log("[v0] Bulk saved emails API - Processing JSON bulk add")

      let body
      try {
        body = await request.json()
      } catch (parseError) {
        console.error("[v0] Bulk saved emails API - JSON parse error:", parseError)
        return NextResponse.json(
          {
            error: "Invalid JSON format. For CSV uploads, please use the file upload feature.",
          },
          { status: 400 },
        )
      }

      console.log("[v0] Bulk saved emails API - Request body:", body)

      const { emails } = body

      if (!emails || !Array.isArray(emails) || emails.length === 0) {
        console.error("[v0] Bulk saved emails API - Invalid emails array:", emails)
        return NextResponse.json({ error: "Invalid emails array" }, { status: 400 })
      }

      console.log("[v0] Bulk saved emails API - Processing", emails.length, "emails from JSON")

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      const validEmails = emails.filter((emailItem) => {
        const email = typeof emailItem === "string" ? emailItem : emailItem.email
        const isValid = email && emailRegex.test(email)
        console.log("[v0] Bulk saved emails API - Email validation:", email, "valid:", isValid)
        return isValid
      })

      console.log("[v0] Bulk saved emails API - Valid emails from JSON:", validEmails.length)

      if (validEmails.length === 0) {
        console.error("[v0] Bulk saved emails API - No valid emails provided in JSON")
        return NextResponse.json({ error: "No valid emails provided" }, { status: 400 })
      }

      const emailsToInsert = validEmails.map((emailItem) => {
        const email = typeof emailItem === "string" ? emailItem : emailItem.email
        const name = typeof emailItem === "object" && emailItem.name ? emailItem.name : null
        return {
          user_id: user.id,
          team_id: null,
          email: email.toLowerCase().trim(),
          name,
          source: "bulk",
        }
      })

      console.log("[v0] Bulk saved emails API - Checking for existing JSON emails")
      const { data: existingEmails } = await db
        .from("saved_emails")
        .select("email")
        .eq("user_id", user.id)
        .is("team_id", null)
        .in(
          "email",
          emailsToInsert.map((e) => e.email),
        )

      const existingEmailSet = new Set(existingEmails?.map((e) => e.email) || [])
      const newEmails = emailsToInsert.filter((e) => !existingEmailSet.has(e.email))
      const duplicateCount = emailsToInsert.length - newEmails.length

      console.log(
        "[v0] Bulk saved emails API - Found",
        duplicateCount,
        "JSON duplicates,",
        newEmails.length,
        "new emails",
      )

      if (newEmails.length === 0) {
        console.log("[v0] Bulk saved emails API - All JSON emails already exist")
        return NextResponse.json({
          success: true,
          added: 0,
          skipped: duplicateCount,
          message: "All emails already exist",
        })
      }

      console.log("[v0] Bulk saved emails API - Inserting", newEmails.length, "emails from JSON")

      const { data: insertedEmails, error: insertError } = await db
        .from("saved_emails")
        .insert(newEmails)
        .select()

      if (insertError) {
        console.error("[v0] Bulk saved emails API - Database error saving JSON emails:", insertError)
        return NextResponse.json({ error: "Failed to save emails" }, { status: 500 })
      }

      console.log("[v0] Bulk saved emails API - Successfully saved", insertedEmails?.length || 0, "JSON emails")

      return NextResponse.json({
        success: true,
        added: insertedEmails?.length || 0,
        skipped: validEmails.length - (insertedEmails?.length || 0),
      })
    }
  } catch (error) {
    console.error("[v0] Bulk saved emails API - Unexpected error:", error)
    return NextResponse.json(
      {
        error: "Internal server error. Please try again or contact support if the problem persists.",
      },
      { status: 500 },
    )
  }
}

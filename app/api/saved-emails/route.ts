import { type NextRequest, NextResponse } from "next/server"
import { createServiceDatabaseClient } from "@/lib/database/database-adapter"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

export async function GET(request: NextRequest) {
  try {
    console.log("[v0] Saved emails API - GET request started")
    const db = await createServiceDatabaseClient()

    if (!db) {
      console.error("[v0] Saved emails API - Database client not properly initialized")
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 })
    }

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

    console.log("[v0] Saved emails API - User authenticated:", user.email)

    const { searchParams } = new URL(request.url)
    const teamId = searchParams.get("teamId")
    const search = searchParams.get("search")

    const actualTeamId = teamId === "global-multipaks" ? null : teamId
    console.log("[v0] Saved emails API - Team ID:", teamId, "-> Actual team ID:", actualTeamId)

    let query = db
      .from("saved_emails")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })

    // Filter by team if provided and not global
    if (actualTeamId) {
      console.log("[v0] Saved emails API - Filtering by team ID:", actualTeamId)
      query = query.eq("team_id", actualTeamId)
    } else if (teamId === "global-multipaks") {
      // For global multipaks, get emails with no specific team (null team_id)
      console.log("[v0] Saved emails API - Filtering for global multipaks (null team_id)")
      query = query.is("team_id", null)
    }

    // Search functionality
    if (search) {
      console.log("[v0] Saved emails API - Applying search filter:", search)
      query = query.or(`email.ilike.%${search}%,name.ilike.%${search}%`)
    }

    const { data: savedEmails, error } = await query.limit(100)

    if (error) {
      console.error("[v0] Saved emails API - Database error:", error)
      return NextResponse.json({ error: "Failed to fetch saved emails" }, { status: 500 })
    }

    console.log("[v0] Saved emails API - Successfully fetched", savedEmails?.length || 0, "saved emails")
    return NextResponse.json({ savedEmails })
  } catch (error) {
    console.error("[v0] Saved emails API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log("[v0] Saved emails API - POST request started")
    const db = await createServiceDatabaseClient()

    if (!db) {
      console.error("[v0] Saved emails API - Database client not properly initialized")
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 })
    }

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

    console.log("[v0] Saved emails API - User authenticated:", user.email)

    const body = await request.json()
    console.log("[v0] Saved emails API - Request body:", body)

    const { emails, teamId, source = "manual" } = body

    const actualTeamId = teamId === "global-multipaks" ? null : teamId
    console.log("[v0] Saved emails API - Team ID:", teamId, "-> Actual team ID:", actualTeamId)

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      console.error("[v0] Saved emails API - Invalid emails array:", emails)
      return NextResponse.json({ error: "Invalid emails array" }, { status: 400 })
    }

    console.log("[v0] Saved emails API - Processing", emails.length, "emails")

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    const validEmails = emails.filter((emailData) => {
      if (typeof emailData === "string") {
        const isValid = emailRegex.test(emailData)
        console.log("[v0] Saved emails API - String email:", emailData, "valid:", isValid)
        return isValid
      }
      const isValid = emailData.email && emailRegex.test(emailData.email)
      console.log("[v0] Saved emails API - Object email:", emailData.email, "valid:", isValid)
      return isValid
    })

    console.log("[v0] Saved emails API - Valid emails count:", validEmails.length)

    if (validEmails.length === 0) {
      console.error("[v0] Saved emails API - No valid emails provided")
      return NextResponse.json({ error: "No valid emails provided" }, { status: 400 })
    }

    // Prepare data for insertion
    const emailsToInsert = validEmails.map((emailData) => {
      const email = typeof emailData === "string" ? emailData : emailData.email
      const name = typeof emailData === "string" ? null : emailData.name || null

      const insertData = {
        user_id: user.id,
        team_id: actualTeamId,
        email: email.toLowerCase().trim(),
        name: name?.trim() || null,
        source,
      }
      console.log("[v0] Saved emails API - Prepared insert data:", insertData)
      return insertData
    })

    console.log("[v0] Saved emails API - Inserting", emailsToInsert.length, "emails into database")

    const teamCondition = emailsToInsert[0].team_id
    const existingEmailsQuery = db
      .from("saved_emails")
      .select("email")
      .eq("user_id", user.id)
      .in(
        "email",
        emailsToInsert.map((e) => e.email),
      )

    if (teamCondition) {
      existingEmailsQuery.eq("team_id", teamCondition)
    } else {
      existingEmailsQuery.is("team_id", null)
    }

    const { data: existingEmails } = await existingEmailsQuery
    const existingEmailSet = new Set(existingEmails?.map((e) => e.email) || [])

    const newEmails = emailsToInsert.filter((e) => !existingEmailSet.has(e.email))
    const duplicateCount = emailsToInsert.length - newEmails.length

    console.log("[v0] Saved emails API - Found", duplicateCount, "duplicates,", newEmails.length, "new emails")

    if (newEmails.length === 0) {
      console.log("[v0] Saved emails API - All emails already exist")
      return NextResponse.json({
        success: true,
        savedCount: 0,
        skipped: duplicateCount,
        message: "All emails already exist",
        savedEmails: [],
      })
    }

    const { data: insertedEmails, error: insertError } = await db.from("saved_emails").insert(newEmails).select()

    if (insertError) {
      console.error("[v0] Saved emails API - Database error saving emails:", insertError)
      return NextResponse.json({ error: "Failed to save emails" }, { status: 500 })
    }

    console.log("[v0] Saved emails API - Successfully inserted", insertedEmails?.length || 0, "emails")
    return NextResponse.json({
      success: true,
      savedCount: insertedEmails?.length || 0,
      skipped: duplicateCount,
      savedEmails: insertedEmails,
    })
  } catch (error) {
    console.error("[v0] Saved emails API - Unexpected error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    console.log("[v0] Saved emails API - DELETE request started")
    const db = await createServiceDatabaseClient()

    if (!db) {
      console.error("[v0] Saved emails API - Database client not properly initialized")
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 })
    }

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

    const { searchParams } = new URL(request.url)
    const emailId = searchParams.get("id")
    const email = searchParams.get("email")
    const teamId = searchParams.get("teamId")

    if (!emailId && !email) {
      return NextResponse.json({ error: "Email ID or email address required" }, { status: 400 })
    }

    let query = db.from("saved_emails").delete().eq("user_id", user.id)

    if (emailId) {
      query = query.eq("id", emailId)
    } else if (email) {
      query = query.eq("email", email.toLowerCase().trim())
      if (teamId) {
        query = query.eq("team_id", teamId)
      }
    }

    const { error } = await query

    if (error) {
      console.error("Error deleting saved email:", error)
      return NextResponse.json({ error: "Failed to delete email" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Delete saved email API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

import { createDatabaseClient } from "@/lib/database/database-adapter"
import { type NextRequest, NextResponse } from "next/server"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

export async function POST(request: NextRequest) {
  try {
    const db = await createDatabaseClient()

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
    const { accounts } = body

    if (!Array.isArray(accounts) || accounts.length === 0) {
      return NextResponse.json({ error: "Invalid accounts data" }, { status: 400 })
    }

    // Get existing emails to avoid duplicates
    const { data: existingAccounts } = await db.from("social_accounts").select("email").eq("owner_id", user.id)

    const existingEmails = new Set(existingAccounts?.map((a) => a.email) || [])

    // Filter out duplicates
    const newAccounts = accounts
      .filter((acc) => acc.email && !existingEmails.has(acc.email))
      .map((acc) => ({
        owner_id: user.id,
        username: acc.username || null,
        email: acc.email,
        full_name: acc.full_name || null,
      }))

    if (newAccounts.length === 0) {
      return NextResponse.json(
        {
          created: 0,
          skipped: accounts.length,
          message: "All accounts already exist",
        },
        { status: 200 },
      )
    }

    const { data, error } = await db.from("social_accounts").insert(newAccounts).select()

    if (error) throw error

    return NextResponse.json({
      created: data?.length || 0,
      skipped: accounts.length - newAccounts.length,
    })
  } catch (error) {
    console.error("Error bulk creating accounts:", error)
    return NextResponse.json({ error: "Failed to create accounts" }, { status: 500 })
  }
}

"use server"

import { NextRequest, NextResponse } from "next/server"
import { createServiceDatabaseClient } from "@/lib/database/service-client"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

export interface SavedSearchFilter {
  id: string
  user_id: string
  name: string
  filters: {
    query?: string
    padIds?: string[]
    tags?: string[]
    dateRange?: { start: string; end: string }
    sortBy?: string
    sortOrder?: "asc" | "desc"
  }
  created_at: string
}

// GET - Get all saved filters for the current user
export async function GET(request: NextRequest) {
  try {
    const authResult = await getCachedAuthUser()
    if (!authResult?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const user = authResult.user
    const db = await createServiceDatabaseClient()

    const { data, error } = await db
      .from("saved_search_filters")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching saved filters:", error)
      return NextResponse.json({ filters: [] })
    }

    return NextResponse.json({ filters: data || [] })
  } catch (error) {
    console.error("Error fetching saved filters:", error)
    return NextResponse.json({ filters: [] })
  }
}

// POST - Save a new search filter
export async function POST(request: NextRequest) {
  try {
    const authResult = await getCachedAuthUser()
    if (!authResult?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const user = authResult.user
    const body = await request.json()
    const { name, filters } = body

    if (!name) {
      return NextResponse.json({ error: "Filter name is required" }, { status: 400 })
    }

    const db = await createServiceDatabaseClient()

    const { data, error } = await db
      .from("saved_search_filters")
      .insert({
        user_id: user.id,
        name,
        filters,
      } as any)
      .select()
      .single()

    if (error) {
      console.error("Error saving search filter:", error)
      return NextResponse.json({ error: "Failed to save filter" }, { status: 500 })
    }

    return NextResponse.json({ filter: data })
  } catch (error) {
    console.error("Error saving search filter:", error)
    return NextResponse.json({ error: "Failed to save filter" }, { status: 500 })
  }
}

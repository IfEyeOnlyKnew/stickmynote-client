"use server"

import { NextRequest, NextResponse } from "next/server"
import { createServiceDatabaseClient } from "@/lib/database/service-client"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

// DELETE - Delete a saved filter
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await getCachedAuthUser()
    if (!authResult?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const user = authResult.user
    const { id } = await params
    const db = await createServiceDatabaseClient()

    const { error } = await db
      .from("saved_search_filters")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id)

    if (error) {
      console.error("Error deleting filter:", error)
      return NextResponse.json({ error: "Failed to delete filter" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting filter:", error)
    return NextResponse.json({ error: "Failed to delete filter" }, { status: 500 })
  }
}

// PATCH - Update a saved filter
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await getCachedAuthUser()
    if (!authResult?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const user = authResult.user
    const { id } = await params
    const body = await request.json()
    const { name, filters } = body

    const db = await createServiceDatabaseClient()

    const updates: any = {}
    if (name !== undefined) updates.name = name
    if (filters !== undefined) updates.filters = filters

    const { data, error } = await db
      .from("saved_search_filters")
      .update(updates)
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single()

    if (error) {
      console.error("Error updating filter:", error)
      return NextResponse.json({ error: "Failed to update filter" }, { status: 500 })
    }

    return NextResponse.json({ filter: data })
  } catch (error) {
    console.error("Error updating filter:", error)
    return NextResponse.json({ error: "Failed to update filter" }, { status: 500 })
  }
}

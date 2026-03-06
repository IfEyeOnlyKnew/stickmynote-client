import { type NextRequest, NextResponse } from "next/server"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"
import { createDatabaseClient } from "@/lib/database/database-adapter"

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const db = await createDatabaseClient()
    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) {
      return NextResponse.json({ error: "Rate limited" }, { status: 429 })
    }
    if (!authResult.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: invoice, error } = await db
      .from("invoices")
      .select("*")
      .eq("id", id)
      .single()

    if (error || !invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 })
    }

    // Fetch line items
    const { data: lineItems } = await db
      .from("invoice_line_items")
      .select("*")
      .eq("invoice_id", id)
      .order("created_at", { ascending: true })

    // Fetch project name
    let project = null
    if (invoice.project_id) {
      const { data: proj } = await db
        .from("paks_pads")
        .select("id, name")
        .eq("id", invoice.project_id)
        .maybeSingle()
      project = proj
    }

    return NextResponse.json({
      invoice: { ...invoice, project, line_items: lineItems || [] },
    })
  } catch (error) {
    console.error("[invoices/[id]] GET error:", error)
    return NextResponse.json({ error: "Failed to fetch invoice" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const db = await createDatabaseClient()
    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) {
      return NextResponse.json({ error: "Rate limited" }, { status: 429 })
    }
    if (!authResult.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const allowedFields = [
      "status", "client_name", "client_email", "tax_rate",
      "notes", "due_date", "paid_date", "subtotal_cents", "total_cents",
    ]

    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field]
      }
    }

    // If marking as sent, set issued_date
    if (body.status === "sent" && !body.issued_date) {
      updateData.issued_date = new Date().toISOString().split("T")[0]
    }

    const { data: invoice, error } = await db
      .from("invoices")
      .update(updateData)
      .eq("id", id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ invoice })
  } catch (error) {
    console.error("[invoices/[id]] PATCH error:", error)
    return NextResponse.json({ error: "Failed to update invoice" }, { status: 500 })
  }
}

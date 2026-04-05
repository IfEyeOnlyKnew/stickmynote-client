import { type NextRequest, NextResponse } from "next/server"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"
import { createDatabaseClient } from "@/lib/database/database-adapter"

export async function GET(request: NextRequest) {
  try {
    const db = await createDatabaseClient()
    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) {
      return NextResponse.json({ error: "Rate limited" }, { status: 429 })
    }
    if (!authResult.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status")
    const projectId = searchParams.get("projectId")

    let query = db
      .from("invoices")
      .select("*")
      .order("created_at", { ascending: false })

    if (status) query = query.eq("status", status)
    if (projectId) query = query.eq("project_id", projectId)

    const { data: invoices, error } = await query

    if (error) {
      if (error.message?.includes("does not exist") || error.code === "42P01") {
        return NextResponse.json({ invoices: [], tableNotFound: true })
      }
      throw error
    }

    // Fetch project names
    const projectIds = [...new Set((invoices || []).map((i: any) => i.project_id).filter(Boolean))]
    let projectMap: Record<string, any> = {}
    if (projectIds.length > 0) {
      const { data: projects } = await db
        .from("paks_pads")
        .select("id, name")
        .in("id", projectIds)
      if (projects) {
        projectMap = Object.fromEntries(projects.map((p: any) => [p.id, p]))
      }
    }

    const enriched = (invoices || []).map((inv: any) => ({
      ...inv,
      project: projectMap[inv.project_id] || null,
    }))

    return NextResponse.json({ invoices: enriched })
  } catch (error) {
    console.error("[invoices] GET error:", error)
    return NextResponse.json({ error: "Failed to fetch invoices" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const db = await createDatabaseClient()
    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) {
      return NextResponse.json({ error: "Rate limited" }, { status: 429 })
    }
    if (!authResult.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const user = authResult.user

    const body = await request.json()
    const {
      projectId,
      clientName,
      clientEmail,
      taxRate = 0,
      notes,
      dueDate,
      lineItems,
      orgId,
    } = body

    if (!lineItems || !Array.isArray(lineItems) || lineItems.length === 0) {
      return NextResponse.json({ error: "At least one line item is required" }, { status: 400 })
    }

    // Generate invoice number: INV-YYYY-NNN
    const year = new Date().getFullYear()
    const { data: countResult } = await db
      .from("invoices")
      .select("id", { count: "exact", head: true })

    const seq = (countResult?.length || 0) + 1
    const invoiceNumber = `INV-${year}-${String(seq).padStart(3, "0")}`

    // Calculate totals
    const subtotalCents = lineItems.reduce((sum: number, item: any) => sum + (item.amountCents || 0), 0)
    const taxAmount = Math.round(subtotalCents * (taxRate / 100))
    const totalCents = subtotalCents + taxAmount

    // Create invoice
    const { data: invoice, error: invoiceError } = await db
      .from("invoices")
      .insert({
        org_id: orgId || null,
        project_id: projectId || null,
        invoice_number: invoiceNumber,
        status: "draft",
        client_name: clientName || null,
        client_email: clientEmail || null,
        subtotal_cents: subtotalCents,
        tax_rate: taxRate,
        total_cents: totalCents,
        notes: notes || null,
        due_date: dueDate || null,
        issued_date: new Date().toISOString().split("T")[0],
        created_by: user.id,
      })
      .select()
      .single()

    if (invoiceError) throw invoiceError

    // Create line items
    const itemRows = lineItems.map((item: any) => ({
      invoice_id: invoice.id,
      time_entry_id: item.timeEntryId || null,
      description: item.description || null,
      hours: item.hours || 0,
      rate_cents: item.rateCents || 0,
      amount_cents: item.amountCents || 0,
    }))

    const { error: itemsError } = await db
      .from("invoice_line_items")
      .insert(itemRows)

    if (itemsError) {
      console.error("[invoices] Line items error:", itemsError)
    }

    return NextResponse.json({ invoice }, { status: 201 })
  } catch (error) {
    console.error("[invoices] POST error:", error)
    return NextResponse.json({ error: "Failed to create invoice" }, { status: 500 })
  }
}

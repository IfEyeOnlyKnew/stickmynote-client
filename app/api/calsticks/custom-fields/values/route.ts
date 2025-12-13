import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const authResult = await getCachedAuthUser(supabase)
    if (authResult.rateLimited) {
      return NextResponse.json({ error: "Rate limited" }, { status: 429, headers: { "Retry-After": "30" } })
    }
    if (!authResult.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    let orgId = null
    try {
      const orgContext = await getOrgContext()
      if (orgContext) {
        orgId = orgContext.orgId
      }
    } catch {
      // No org context - continue without org filtering
    }

    const { searchParams } = new URL(request.url)
    const taskId = searchParams.get("taskId")

    if (!taskId) {
      return NextResponse.json({ error: "Missing taskId" }, { status: 400 })
    }

    const { data, error } = await supabase
      .from("custom_field_values")
      .select(`
        *,
        definition:custom_field_definitions(*)
      `)
      .eq("task_id", taskId)

    if (error) {
      if (error.code === "PGRST204" || error.message?.includes("Could not find the table")) {
        return NextResponse.json({
          values: [],
          tableNotFound: true,
          message: "Custom fields table not created yet. Run scripts/add-calstick-custom-fields.sql",
        })
      }
      return NextResponse.json({ error: "Failed to fetch field values" }, { status: 500 })
    }

    return NextResponse.json({ values: data })
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const authResult = await getCachedAuthUser(supabase)
    if (authResult.rateLimited) {
      return NextResponse.json({ error: "Rate limited" }, { status: 429, headers: { "Retry-After": "30" } })
    }
    if (!authResult.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    let orgId = null
    try {
      const orgContext = await getOrgContext()
      if (orgContext) {
        orgId = orgContext.orgId
      }
    } catch {
      // No org context - continue without it
    }

    const body = await request.json()
    const { taskId, fieldId, value, type } = body

    const valueData: any = {
      task_id: taskId,
      field_id: fieldId,
      value_text: null,
      value_number: null,
      value_date: null,
      value_boolean: null,
    }

    if (type === "number") {
      valueData.value_number = value
    } else if (type === "date") {
      valueData.value_date = value
    } else if (type === "boolean") {
      valueData.value_boolean = value
    } else {
      valueData.value_text = value
    }

    const { data, error } = await supabase
      .from("custom_field_values")
      .upsert(valueData, { onConflict: "task_id, field_id" })
      .select()
      .single()

    if (error) {
      if (error.code === "PGRST204" || error.message?.includes("Could not find the table")) {
        return NextResponse.json(
          {
            error: "Custom fields table not created yet",
            tableNotFound: true,
          },
          { status: 400 },
        )
      }
      return NextResponse.json({ error: "Failed to save field value" }, { status: 500 })
    }

    return NextResponse.json({ value: data })
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

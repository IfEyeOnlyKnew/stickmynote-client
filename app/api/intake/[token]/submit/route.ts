import { type NextRequest, NextResponse } from "next/server"
import { createDatabaseClient } from "@/lib/database/database-adapter"

export async function POST(request: NextRequest, { params }: { params: { token: string } }) {
  try {
    const db = await createDatabaseClient()
    const { token } = params
    const body = await request.json()
    const { data: submissionData } = body

    // Fetch form configuration
    const { data: form, error: formError } = await db
      .from("intake_forms")
      .select("id, pad_id, default_priority, default_status, auto_assign_to")
      .eq("share_token", token)
      .eq("is_active", true)
      .single()

    if (formError || !form) {
      return NextResponse.json({ error: "Form not found or inactive" }, { status: 404 })
    }

    // Get a stick from this pad to attach the task to
    const { data: sticks, error: sticksError } = await db
      .from("paks_pad_sticks")
      .select("id")
      .eq("pad_id", form.pad_id)
      .limit(1)

    if (sticksError || !sticks || sticks.length === 0) {
      return NextResponse.json({ error: "No stick found for this pad" }, { status: 500 })
    }

    const stickId = sticks[0].id

    // Create task from submission
    const taskContent = submissionData.description || submissionData.message || JSON.stringify(submissionData, null, 2)

    const { data: task, error: taskError } = await db
      .from("paks_pad_stick_replies")
      .insert({
        stick_id: stickId,
        user_id: form.auto_assign_to, // Will be null if not set
        content: taskContent,
        is_calstick: true,
        calstick_priority: form.default_priority,
        calstick_status: form.default_status,
        calstick_assignee_id: form.auto_assign_to,
        calstick_description: `Submitted via intake form\n\n${JSON.stringify(submissionData, null, 2)}`,
      })
      .select()
      .single()

    if (taskError) {
      console.error("[v0] Error creating task:", taskError)
      return NextResponse.json({ error: "Failed to create task" }, { status: 500 })
    }

    // Record submission
    const { error: submissionError } = await db.from("intake_form_submissions").insert({
      form_id: form.id,
      task_id: task.id,
      submission_data: submissionData,
      submitter_email: submissionData.email,
      submitter_name: submissionData.name,
    })

    if (submissionError) {
      console.error("[v0] Error recording submission:", submissionError)
    }

    return NextResponse.json({ success: true, taskId: task.id })
  } catch (error) {
    console.error("[v0] Intake submission error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

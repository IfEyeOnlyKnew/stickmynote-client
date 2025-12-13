import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

// Cron job to check for items that need escalation
export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = await createClient()

  try {
    // Get all active escalation rules
    const { data: rules, error: rulesError } = await supabase
      .from("notification_escalation_rules")
      .select("*")
      .eq("is_active", true)

    if (rulesError) {
      throw rulesError
    }

    const results = {
      processed: 0,
      escalated: 0,
      errors: 0,
    }

    for (const rule of rules || []) {
      try {
        // Process based on trigger type
        if (rule.trigger_type === "no_reply") {
          const hoursThreshold = (rule.trigger_conditions as { hours_threshold?: number })?.hours_threshold || 8
          const cutoffTime = new Date()
          cutoffTime.setHours(cutoffTime.getHours() - hoursThreshold)

          // Find sticks with no replies in the threshold period
          const { data: sticks } = await supabase
            .from("social_sticks")
            .select("id, user_id, topic, social_pad_id")
            .eq("user_id", rule.user_id)
            .lt("created_at", cutoffTime.toISOString())

          for (const stick of sticks || []) {
            // Check if already escalated recently
            const { data: existingEscalation } = await supabase
              .from("notification_escalations")
              .select("id, escalation_count")
              .eq("rule_id", rule.id)
              .eq("entity_type", "stick")
              .eq("entity_id", stick.id)
              .gte("created_at", new Date(Date.now() - rule.cooldown_minutes * 60 * 1000).toISOString())
              .single()

            if (!existingEscalation && rule.max_escalations > 0) {
              // Create escalation
              await supabase.from("notification_escalations").insert({
                rule_id: rule.id,
                user_id: rule.user_id,
                entity_type: "stick",
                entity_id: stick.id,
                status: "pending",
              })
              results.escalated++
            }
          }
        }

        results.processed++
      } catch (err) {
        console.error(`Error processing rule ${rule.id}:`, err)
        results.errors++
      }
    }

    return NextResponse.json({
      success: true,
      results,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Error in escalation cron:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

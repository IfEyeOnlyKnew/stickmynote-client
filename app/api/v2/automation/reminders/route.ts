import { type NextRequest } from "next/server"
import { handleGetReminders, handleCreateReminder } from "@/lib/handlers/automation-reminders-handler"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  return handleGetReminders(request)
}

export async function POST(request: NextRequest) {
  return handleCreateReminder(request)
}

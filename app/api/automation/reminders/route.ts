import { type NextRequest } from "next/server"
import { handleGetReminders, handleCreateReminder } from "@/lib/handlers/automation-reminders-handler"

export async function GET(req: NextRequest) {
  return handleGetReminders(req)
}

export async function POST(req: NextRequest) {
  return handleCreateReminder(req)
}

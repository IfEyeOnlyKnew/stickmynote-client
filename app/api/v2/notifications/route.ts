import { type NextRequest } from "next/server"
import { handleGetNotifications, handleCreateNotification } from "@/lib/handlers/notifications-handler"

export const dynamic = "force-dynamic"

// GET /api/v2/notifications - Fetch user notifications
export async function GET(request: NextRequest) {
  return handleGetNotifications(request)
}

// POST /api/v2/notifications - Create a notification (system use)
export async function POST(request: NextRequest) {
  return handleCreateNotification(request)
}

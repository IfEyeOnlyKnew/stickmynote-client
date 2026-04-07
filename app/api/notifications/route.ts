import { handleGetNotifications, handleCreateNotification } from "@/lib/handlers/notifications-handler"

// GET /api/notifications - Fetch user notifications
export async function GET(request: Request) {
  return handleGetNotifications(request)
}

// POST /api/notifications - Create a notification (system use)
export async function POST(request: Request) {
  return handleCreateNotification(request)
}

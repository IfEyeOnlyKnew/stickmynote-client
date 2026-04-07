import { type NextRequest } from "next/server"
import { handleGetReplies, handleCreateReply } from "@/lib/handlers/replies-handler"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  return handleGetReplies(request)
}

export async function POST(request: NextRequest) {
  return handleCreateReply(request)
}

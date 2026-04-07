import { type NextRequest } from "next/server"
import {
  handleGetStickReplies,
  handleCreateStickReply,
  handleUpdateStickReply,
  handleDeleteStickReply,
} from "@/lib/handlers/stick-replies-handler"

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return handleGetStickReplies(id)
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return handleCreateStickReply(request, id)
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await params
  return handleUpdateStickReply(request)
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return handleDeleteStickReply(request, id)
}

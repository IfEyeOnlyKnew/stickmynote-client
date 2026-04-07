import { type NextRequest } from "next/server"
import { handlePutStick, handlePatchStick, handleDeleteStick } from "@/lib/handlers/stick-detail-handler"

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  return handlePutStick(request, id)
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  return handlePatchStick(request, id)
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  return handleDeleteStick(id)
}

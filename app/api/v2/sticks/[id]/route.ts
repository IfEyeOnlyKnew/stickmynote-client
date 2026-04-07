import { type NextRequest } from "next/server"
import { handlePutStick, handlePatchStick, handleDeleteStick } from "@/lib/handlers/stick-detail-handler"

export const dynamic = "force-dynamic"

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return handlePutStick(request, id)
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return handlePatchStick(request, id)
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return handleDeleteStick(id)
}

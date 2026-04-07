import { type NextRequest } from "next/server"
import {
  handleGetStickTabs,
  handlePostStickTab,
  handlePutStickTab,
} from "@/lib/handlers/stick-tabs-handler"

export const dynamic = "force-dynamic"

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return handleGetStickTabs(id)
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return handlePostStickTab(request, id)
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return handlePutStickTab(request, id)
}

import { type NextRequest } from "next/server"
import {
  handleGetStickTabs,
  handlePostStickTab,
  handlePutStickTab,
} from "@/lib/handlers/stick-tabs-handler"

export const dynamic = "force-dynamic"

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  return handleGetStickTabs(id)
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  return handlePostStickTab(request, id)
}

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  return handlePutStickTab(request, id)
}

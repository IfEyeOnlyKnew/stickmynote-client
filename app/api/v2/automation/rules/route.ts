import { type NextRequest } from "next/server"
import { handleGetAutomationRules, handleCreateAutomationRule } from "@/lib/handlers/automation-rules-handler"

export const dynamic = "force-dynamic"

export async function GET(_request: NextRequest) {
  return handleGetAutomationRules()
}

export async function POST(request: NextRequest) {
  return handleCreateAutomationRule(request)
}

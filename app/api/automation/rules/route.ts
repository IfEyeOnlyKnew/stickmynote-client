import { type NextRequest } from "next/server"
import { handleGetAutomationRules, handleCreateAutomationRule } from "@/lib/handlers/automation-rules-handler"

export async function GET(_req: NextRequest) {
  return handleGetAutomationRules()
}

export async function POST(req: NextRequest) {
  return handleCreateAutomationRule(req)
}

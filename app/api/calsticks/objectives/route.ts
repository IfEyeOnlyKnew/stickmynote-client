import { NextResponse } from "next/server"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"
import { getObjectives, createObjective } from "@/lib/handlers/calsticks-objectives-handler"

export async function GET() {
  try {
    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) {
      return NextResponse.json({ error: "Rate limited" }, { status: 429, headers: { "Retry-After": "30" } })
    }
    if (!authResult.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const orgContext = await getOrgContext()
    if (!orgContext) {
      return NextResponse.json({ error: "No organization context" }, { status: 403 })
    }

    const objectives = await getObjectives(authResult.user, orgContext)
    return NextResponse.json(objectives)
  } catch (error) {
    console.error("Error fetching objectives:", error)
    return NextResponse.json({ error: "Failed to fetch objectives" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const authResult = await getCachedAuthUser()
    if (authResult.rateLimited) {
      return NextResponse.json({ error: "Rate limited" }, { status: 429, headers: { "Retry-After": "30" } })
    }
    if (!authResult.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const orgContext = await getOrgContext()
    if (!orgContext) {
      return NextResponse.json({ error: "No organization context" }, { status: 403 })
    }

    const body = await request.json()
    const objective = await createObjective(authResult.user, orgContext, body)
    return NextResponse.json(objective)
  } catch (error) {
    console.error("Error creating objective:", error)
    return NextResponse.json({ error: "Failed to create objective" }, { status: 500 })
  }
}

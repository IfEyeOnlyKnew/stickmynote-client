import { NextResponse } from "next/server"
import { createDatabaseClient } from "@/lib/database/database-adapter"
import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from "@/lib/auth/cached-auth"
import { getOrgContext } from "@/lib/auth/get-org-context"
import {
  type Hyperlink,
  fetchHyperlinks,
  formatHyperlinks,
  validateGenerateTagsInput,
} from "@/lib/handlers/stick-generate-tags-handler"

function generateSearchQueries(topic: string, content: string): string[] {
  // Create search queries directly from topic and content without AI
  const queries: string[] = []

  // Use topic as primary search query
  if (topic?.trim()) {
    queries.push(topic.trim(), `${topic.trim()} tutorial`, `${topic.trim()} guide`)
  }

  // Extract key phrases from content (first 100 chars)
  if (content?.trim()) {
    const contentPreview = content.trim().substring(0, 100)
    // Get first sentence or phrase
    const firstPhrase = contentPreview.split(/[.!?]/)[0]?.trim()
    if (firstPhrase && firstPhrase.length > 5 && !queries.includes(firstPhrase)) {
      queries.push(firstPhrase)
    }
  }

  return queries.slice(0, 3)
}

async function validateAndAuthorize() {
  const { user, error: authError } = await getCachedAuthUser()

  if (authError === "rate_limited") return { error: createRateLimitResponse() }
  if (!user) return { error: createUnauthorizedResponse() }

  return { user }
}

async function checkStickAccess(db: Awaited<ReturnType<typeof createDatabaseClient>>, stickId: string, userId: string, orgId: string) {
  // Check if user owns the stick
  const { data: stick, error: stickError } = await db
    .from("paks_pad_sticks")
    .select("id, user_id, pad_id")
    .eq("id", stickId)
    .maybeSingle()

  if (stickError || !stick) {
    return { error: NextResponse.json({ error: "Stick not found" }, { status: 404 }) }
  }

  // Owner has access
  if (stick.user_id === userId) {
    return { stick }
  }

  // Check pad membership for non-owners
  if (stick.pad_id) {
    const { data: membership } = await db
      .from("paks_pad_members")
      .select("role")
      .eq("pad_id", stick.pad_id)
      .eq("user_id", userId)
      .eq("accepted", true)
      .maybeSingle()

    if (membership && (membership.role === "admin" || membership.role === "edit")) {
      return { stick }
    }
  }

  return { error: NextResponse.json({ error: "Unauthorized" }, { status: 403 }) }
}

function handleError(error: unknown): NextResponse {
  if (error instanceof Error && error.message === "RATE_LIMITED") {
    return createRateLimitResponse()
  }
  console.error("[Generate Links] Error:", error)
  return NextResponse.json(
    {
      error: "Failed to generate links",
      details: error instanceof Error ? error.message : "Unknown error",
    },
    { status: 500 },
  )
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: stickId } = await params
    const { topic, content } = await req.json()

    console.log(`[Generate Links] Request for stick ${stickId}, topic: "${topic}"`)

    const inputError = validateGenerateTagsInput(topic, content)
    if (inputError) {
      return NextResponse.json({ error: inputError }, { status: 400 })
    }

    const authResult = await validateAndAuthorize()
    if ("error" in authResult) return authResult.error

    const { user } = authResult
    const db = await createDatabaseClient()

    const orgContext = await getOrgContext()
    if (!orgContext) {
      return NextResponse.json({ error: "Organization context required" }, { status: 403 })
    }

    const accessResult = await checkStickAccess(db, stickId, user.id, orgContext.orgId)
    if ("error" in accessResult) return accessResult.error

    const noteText = `${topic || ""} ${content || ""}`.trim()
    if (!noteText) {
      return NextResponse.json({ error: "No content to analyze" }, { status: 400 })
    }

    const searchQueries = generateSearchQueries(topic || "", content || "")
    console.log(`[Generate Links] Search queries: ${JSON.stringify(searchQueries)}`)

    const hyperlinks = await fetchHyperlinks(searchQueries)
    const formattedHyperlinks = formatHyperlinks(hyperlinks)
    console.log(`[Generate Links] Generated ${formattedHyperlinks.length} hyperlinks`)

    if (formattedHyperlinks.length > 0) {
      await saveStickHyperlinks(db, stickId, formattedHyperlinks, user.id, orgContext.orgId)
    }

    // Return both tags (empty) and hyperlinks for backward compatibility
    return NextResponse.json({
      tags: [],
      hyperlinks: formattedHyperlinks,
      message: formattedHyperlinks.length === 0 ? "No links found for this content." : undefined,
    })
  } catch (error) {
    return handleError(error)
  }
}

async function saveStickHyperlinks(
  db: Awaited<ReturnType<typeof createDatabaseClient>>,
  stickId: string,
  hyperlinks: Hyperlink[],
  userId: string,
  orgId: string
): Promise<void> {
  if (hyperlinks.length === 0) return

  const { data: existingLinksTab } = await db
    .from("paks_pad_stick_tabs")
    .select("id")
    .eq("stick_id", stickId)
    .eq("tab_type", "links")
    .eq("org_id", orgId)
    .maybeSingle()

  const tabData = JSON.stringify({ hyperlinks })

  if (existingLinksTab) {
    await db
      .from("paks_pad_stick_tabs")
      .update({ tab_data: tabData, updated_at: new Date().toISOString() })
      .eq("id", existingLinksTab.id)
      .eq("org_id", orgId)
  } else {
    await db.from("paks_pad_stick_tabs").insert({
      stick_id: stickId,
      user_id: userId,
      org_id: orgId,
      tab_name: "Links",
      tab_type: "links",
      tab_content: "",
      tab_data: tabData,
      tab_order: 98,
    })
  }

  console.log(`[Generate Links] Saved ${hyperlinks.length} hyperlinks to database`)
}

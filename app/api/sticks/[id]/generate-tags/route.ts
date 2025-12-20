import { NextResponse } from "next/server"
import { generateText } from "ai"
import { createDatabaseClient } from "@/lib/database/database-adapter"
import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from "@/lib/auth/cached-auth"

type Hyperlink = { url: string; title: string }

function parseJsonArrayResponse(response: string, fallback: string[] = []): string[] {
  try {
    const parsed = JSON.parse(response.trim())
    if (!Array.isArray(parsed)) return fallback
    return parsed
      .filter((item) => typeof item === "string" && item.trim().length > 0)
      .map((item) => item.trim())
  } catch {
    return fallback
  }
}

function parseTags(response: string): string[] {
  const tags = parseJsonArrayResponse(response)
  if (tags.length > 0) {
    return tags.map((tag) => tag.toLowerCase()).slice(0, 5)
  }
  const words = response.toLowerCase().match(/\b\w+\b/g) || []
  return words.slice(0, 3)
}

function parseSearchQueries(response: string, fallbackTags: string[]): string[] {
  const queries = parseJsonArrayResponse(response)
  if (queries.length > 0) return queries.slice(0, 5)
  return fallbackTags.map((tag) => `${tag} tutorial guide`)
}

async function fetchBraveSearchWithRetry(query: string, maxRetries = 2): Promise<Hyperlink[]> {
  for (let retries = 0; retries <= maxRetries; retries++) {
    try {
      const response = await fetch(
        `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=3`,
        {
          headers: {
            "X-Subscription-Token": process.env.BRAVE_API_KEY!,
            Accept: "application/json",
          },
        },
      )

      if (response.status === 429 && retries < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, Math.pow(2, retries) * 1000))
        continue
      }

      if (!response.ok) return []

      const data = await response.json()
      return (data.web?.results || []).map((result: { url: string; title?: string }) => ({
        url: result.url,
        title: result.title || result.url,
      }))
    } catch (fetchError) {
      console.warn(`Fetch error on retry ${retries}:`, fetchError)
      if (retries < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 1000))
        continue
      }
    }
  }
  return []
}

async function fetchHyperlinks(searchQueries: string[]): Promise<Hyperlink[]> {
  if (!process.env.BRAVE_API_KEY || searchQueries.length === 0) return []

  try {
    const searchPromises = searchQueries.slice(0, 2).map((query) => fetchBraveSearchWithRetry(query))
    const searchResults = await Promise.all(searchPromises)
    return searchResults.flat().slice(0, 8)
  } catch (error) {
    console.error("Error fetching from Brave API:", error)
    return []
  }
}

function formatHyperlinks(hyperlinks: Hyperlink[]): Hyperlink[] {
  return hyperlinks.map((link) => ({
    url: link.url.startsWith("http") ? link.url : `https://${link.url}`,
    title: link.title,
  }))
}

async function generateTagsFromAI(noteText: string): Promise<string[]> {
  const tagsResult = await generateText({
    model: "xai/grok-3" as any,
    prompt: `Analyze the following note content and generate 3-5 relevant tags that categorize the main topics, themes, or subjects discussed. Return only the tags as a JSON array of strings, no additional text or formatting.

Note content: "${noteText}"

Example response format: ["technology", "productivity", "planning"]`,
  })
  return parseTags(tagsResult.text || "[]")
}

async function generateSearchQueriesFromAI(noteText: string, fallbackTags: string[]): Promise<string[]> {
  const searchQueriesResult = await generateText({
    model: "xai/grok-3" as any,
    prompt: `Based on the following note content, generate 3-5 specific search queries that would help find relevant, useful websites and resources. Focus on actionable, informative content rather than generic searches.

Note content: "${noteText}"

Return only a JSON array of search query strings, no additional text.

Example response format: ["react hooks tutorial", "javascript best practices 2024", "web development tools"]`,
  })
  return parseSearchQueries(searchQueriesResult.text || "[]", fallbackTags)
}

async function validateAndAuthorize() {
  const { user, error: authError } = await getCachedAuthUser()
  
  if (authError === "rate_limited") return { error: createRateLimitResponse() }
  if (!user) return { error: createUnauthorizedResponse() }

  return { user }
}

async function validateStickOwnership(db: Awaited<ReturnType<typeof createDatabaseClient>>, stickId: string, userId: string) {
  const { data: stick, error: stickError } = await db
    .from("paks_pad_sticks")
    .select("user_id")
    .eq("id", stickId)
    .maybeSingle()

  if (stickError || !stick) return { error: NextResponse.json({ error: "Stick not found" }, { status: 404 }) }
  if (stick.user_id !== userId) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 403 }) }

  return { stick }
}

function validateInput(topic: string | undefined, content: string | undefined): NextResponse | null {
  if (!topic && !content) return NextResponse.json({ error: "Missing topic or content" }, { status: 400 })
  if (!process.env.XAI_API_KEY) return NextResponse.json({ error: "XAI_API_KEY not configured" }, { status: 500 })
  return null
}

async function generateTagsAndHyperlinks(noteText: string): Promise<{ tags: string[]; hyperlinks: Hyperlink[] }> {
  const tags = await generateTagsFromAI(noteText)
  const searchQueries = await generateSearchQueriesFromAI(noteText, tags)
  const hyperlinks = await fetchHyperlinks(searchQueries)
  return { tags, hyperlinks: formatHyperlinks(hyperlinks) }
}

function handleError(error: unknown): NextResponse {
  if (error instanceof Error && error.message === "RATE_LIMITED") {
    return createRateLimitResponse()
  }
  console.error("Error in generate tags API:", error)
  return NextResponse.json(
    {
      error: "Failed to generate tags",
      details: error instanceof Error ? error.message : "Unknown error",
    },
    { status: 500 },
  )
}

function buildResponseMessage(tags: string[], hyperlinks: Hyperlink[]): string | undefined {
  return tags.length === 0 && hyperlinks.length === 0
    ? "Having issues now or no results to display at this time."
    : undefined
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const { topic, content } = await req.json()
    const stickId = params.id

    const inputError = validateInput(topic, content)
    if (inputError) return inputError

    const authResult = await validateAndAuthorize()
    if ("error" in authResult) return authResult.error

    const { user } = authResult
    const db = await createDatabaseClient()

    const ownershipResult = await validateStickOwnership(db, stickId, user.id)
    if ("error" in ownershipResult) return ownershipResult.error

    const noteText = `${topic || ""} ${content || ""}`.trim()
    if (!noteText) return NextResponse.json({ error: "No content to analyze" }, { status: 400 })

    const { tags, hyperlinks } = await generateTagsAndHyperlinks(noteText)

    if (tags.length > 0 || hyperlinks.length > 0) {
      await saveStickTags(db, stickId, tags, user.id)
      await saveStickHyperlinks(db, stickId, hyperlinks, user.id)
    }

    return NextResponse.json({
      tags,
      hyperlinks,
      message: buildResponseMessage(tags, hyperlinks),
    })
  } catch (error) {
    return handleError(error)
  }
}

async function saveStickTags(db: Awaited<ReturnType<typeof createDatabaseClient>>, stickId: string, tags: string[], userId: string): Promise<void> {
  if (tags.length === 0) return

  const { data: existingTagsTab } = await db
    .from("paks_pad_stick_tabs")
    .select("id")
    .eq("stick_id", stickId)
    .eq("tab_type", "tags")
    .maybeSingle()

  const tabData = JSON.stringify({ tags })

  if (existingTagsTab) {
    await db
      .from("paks_pad_stick_tabs")
      .update({ tab_data: tabData, updated_at: new Date().toISOString() })
      .eq("id", existingTagsTab.id)
  } else {
    await db.from("paks_pad_stick_tabs").insert({
      stick_id: stickId,
      user_id: userId,
      tab_name: "Tags",
      tab_type: "tags",
      tab_content: "",
      tab_data: tabData,
      tab_order: 97,
    })
  }
}

async function saveStickHyperlinks(db: Awaited<ReturnType<typeof createDatabaseClient>>, stickId: string, hyperlinks: Hyperlink[], userId: string): Promise<void> {
  if (hyperlinks.length === 0) return

  const { data: existingLinksTab } = await db
    .from("paks_pad_stick_tabs")
    .select("id")
    .eq("stick_id", stickId)
    .eq("tab_type", "links")
    .maybeSingle()

  const tabData = JSON.stringify({ hyperlinks })

  if (existingLinksTab) {
    await db
      .from("paks_pad_stick_tabs")
      .update({ tab_data: tabData, updated_at: new Date().toISOString() })
      .eq("id", existingLinksTab.id)
  } else {
    await db.from("paks_pad_stick_tabs").insert({
      stick_id: stickId,
      user_id: userId,
      tab_name: "Links",
      tab_type: "links",
      tab_content: "",
      tab_data: tabData,
      tab_order: 98,
    })
  }
}

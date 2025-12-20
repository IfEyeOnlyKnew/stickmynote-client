import { NextResponse } from "next/server"
import { generateText } from "ai"
import { createDatabaseClient } from "@/lib/database/database-adapter"
import { applyRateLimit } from "@/lib/rate-limiter-enhanced"
import { Redis } from "@upstash/redis"
import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from "@/lib/auth/cached-auth"
import { getOrgContext } from "@/lib/auth/get-org-context"

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
})

type Hyperlink = { url: string; title: string }

function getCacheKey(topic: string, orgId: string): string {
  return `tags:${orgId}:${Buffer.from(topic).toString("base64").slice(0, 50)}`
}

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
    const searchPromises = searchQueries.slice(0, 2).map(async (query, index) => {
      if (index > 0) await new Promise((resolve) => setTimeout(resolve, 1100))
      return fetchBraveSearchWithRetry(query)
    })

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

async function getCachedResult(cacheKey: string): Promise<object | null> {
  try {
    const cached = await redis.get(cacheKey)
    if (cached && typeof cached === "object") return cached
  } catch (cacheError) {
    console.warn("Cache read error:", cacheError)
  }
  return null
}

async function setCachedResult(cacheKey: string, result: object): Promise<void> {
  try {
    await redis.set(cacheKey, JSON.stringify(result), { ex: 86400 })
  } catch (cacheError) {
    console.warn("Cache write error:", cacheError)
  }
}

async function validateAndAuthorize(req: Request) {
  const { user, error: authError } = await getCachedAuthUser()
  
  if (authError === "rate_limited") return { error: createRateLimitResponse() }
  if (!user) return { error: createUnauthorizedResponse("Unauthorized. Please log in to generate tags.") }

  const orgContext = await getOrgContext(user.id)
  if (!orgContext) return { error: NextResponse.json({ error: "No organization context" }, { status: 403 }) }

  const rateLimitResult = await applyRateLimit(req, user.id, "ai_generate_tags")
  if (!rateLimitResult.success) {
    return {
      error: NextResponse.json(
        { error: "Too many tag generation requests. Please try again later." },
        { status: 429, headers: { "Retry-After": "60", ...rateLimitResult.headers } },
      ),
    }
  }

  return { user, orgContext }
}

function validateInput(topic: string | undefined, noteId: string | undefined): NextResponse | null {
  if (!topic?.trim()) return NextResponse.json({ error: "Missing topic" }, { status: 400 })
  if (!noteId) return NextResponse.json({ error: "Missing noteId" }, { status: 400 })
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
  console.error("Error in generate-tags API:", error)
  return NextResponse.json(
    {
      error: "Failed to generate tags",
      details: error instanceof Error ? error.message : "Unknown error",
    },
    { status: 500 },
  )
}

export async function POST(req: Request) {
  try {
    const authResult = await validateAndAuthorize(req)
    if ("error" in authResult) return authResult.error

    const { user, orgContext } = authResult
    const { topic, noteId, isTeamNote } = await req.json()

    const inputError = validateInput(topic, noteId)
    if (inputError) return inputError

    const noteText = topic.trim()
    const cacheKey = getCacheKey(noteText, orgContext.orgId)

    const cached = await getCachedResult(cacheKey)
    if (cached) return NextResponse.json(cached)

    const { tags, hyperlinks } = await generateTagsAndHyperlinks(noteText)

    if (tags.length === 0 && hyperlinks.length === 0) {
      return NextResponse.json({
        tags: [],
        hyperlinks: [],
        message: "Unable to generate tags or hyperlinks at this time.",
      })
    }

    await setCachedResult(cacheKey, { tags, hyperlinks })

    if (isTeamNote) {
      await saveTeamNoteTags(noteId, tags, user.id, orgContext.orgId)
      await saveTeamNoteHyperlinks(noteId, hyperlinks, user.id, orgContext.orgId)
    }

    return NextResponse.json({ tags, hyperlinks })
  } catch (error) {
    return handleError(error)
  }
}

async function saveTeamNoteTags(noteId: string, tags: string[], userId: string, orgId: string): Promise<void> {
  if (tags.length === 0) return

  const db = await createDatabaseClient()
  await db.from("team_note_tags").delete().eq("team_note_id", noteId).eq("org_id", orgId)

  const tagInserts = tags.map((tag, index) => ({
    team_note_id: noteId,
    user_id: userId,
    tag_title: tag,
    tag_content: tag,
    tag_order: index + 1,
    org_id: orgId,
  }))

  const { error: insertError } = await db.from("team_note_tags").insert(tagInserts)
  if (insertError) console.warn("Error saving team note tags:", insertError)
}

async function saveTeamNoteHyperlinks(noteId: string, hyperlinks: Hyperlink[], userId: string, orgId: string): Promise<void> {
  if (hyperlinks.length === 0) return

  const db = await createDatabaseClient()
  const { data: existingTab } = await db
    .from("team_note_tabs")
    .select("id")
    .eq("team_note_id", noteId)
    .eq("tab_name", "Links")
    .eq("org_id", orgId)
    .maybeSingle()

  const tabData = JSON.stringify({ hyperlinks })

  if (existingTab) {
    const { error: updateError } = await db
      .from("team_note_tabs")
      .update({ tab_data: tabData, updated_at: new Date().toISOString() })
      .eq("id", existingTab.id)
    if (updateError) console.warn("Error updating team note hyperlinks:", updateError)
  } else {
    const { error: insertError } = await db.from("team_note_tabs").insert({
      team_note_id: noteId,
      user_id: userId,
      tab_name: "Links",
      tab_type: "content",
      tab_content: "",
      tab_data: tabData,
      tab_order: 98,
      org_id: orgId,
    })
    if (insertError) console.warn("Error creating team note Links tab:", insertError)
  }
}

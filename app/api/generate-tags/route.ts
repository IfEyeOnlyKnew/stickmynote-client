import { NextResponse } from "next/server"
import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from "@/lib/auth/cached-auth"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { db } from "@/lib/database/pg-client"

type Hyperlink = { url: string; title: string }

async function fetchSearXNGResults(query: string): Promise<Hyperlink[]> {
  const searxngUrl = process.env.SEARXNG_URL || "https://searx.be"

  try {
    console.log(`[Generate Links] Fetching from SearXNG: ${searxngUrl}/search?q=${encodeURIComponent(query)}`)

    const response = await fetch(
      `${searxngUrl}/search?q=${encodeURIComponent(query)}&format=json&categories=general`,
      {
        headers: {
          Accept: "application/json",
        },
      },
    )

    if (!response.ok) {
      console.warn(`[Generate Links] SearXNG returned status ${response.status}`)
      return []
    }

    const data = await response.json()
    const hyperlinks: Hyperlink[] = []

    if (data.results && Array.isArray(data.results)) {
      for (const result of data.results) {
        if (result.url && result.title) {
          hyperlinks.push({
            url: result.url,
            title: result.title.substring(0, 100) + (result.title.length > 100 ? "..." : ""),
          })
        }
      }
    }

    console.log(`[Generate Links] Found ${hyperlinks.length} results for query: ${query}`)
    return hyperlinks.slice(0, 5)
  } catch (fetchError) {
    console.error("[Generate Links] SearXNG fetch error:", fetchError)
    return []
  }
}

async function fetchHyperlinks(searchQueries: string[]): Promise<Hyperlink[]> {
  if (searchQueries.length === 0) return []

  try {
    const searchPromises = searchQueries.slice(0, 3).map((query) => fetchSearXNGResults(query))
    const searchResults = await Promise.all(searchPromises)

    // Deduplicate by URL
    const seen = new Set<string>()
    const uniqueResults: Hyperlink[] = []
    for (const result of searchResults.flat()) {
      if (!seen.has(result.url)) {
        seen.add(result.url)
        uniqueResults.push(result)
      }
    }

    return uniqueResults.slice(0, 8)
  } catch (error) {
    console.error("[Generate Links] Error fetching hyperlinks:", error)
    return []
  }
}

function formatHyperlinks(hyperlinks: Hyperlink[]): Hyperlink[] {
  return hyperlinks.map((link) => ({
    url: link.url.startsWith("http") ? link.url : `https://${link.url}`,
    title: link.title,
  }))
}

function generateSearchQueries(topic: string): string[] {
  // Create search queries directly from topic without AI
  const queries: string[] = []

  if (topic && topic.trim()) {
    queries.push(topic.trim())
    queries.push(`${topic.trim()} tutorial`)
    queries.push(`${topic.trim()} guide`)
  }

  return queries.slice(0, 3)
}

async function validateAndAuthorize() {
  const { user, error: authError } = await getCachedAuthUser()

  if (authError === "rate_limited") return { error: createRateLimitResponse() }
  if (!user) return { error: createUnauthorizedResponse("Unauthorized. Please log in to generate links.") }

  const orgContext = await getOrgContext()
  if (!orgContext) return { error: NextResponse.json({ error: "No organization context" }, { status: 403 }) }

  return { user, orgContext }
}

function validateInput(topic: string | undefined): NextResponse | null {
  if (!topic?.trim()) return NextResponse.json({ error: "Missing topic" }, { status: 400 })
  return null
}

async function generateHyperlinks(topic: string): Promise<Hyperlink[]> {
  const searchQueries = generateSearchQueries(topic)
  console.log(`[Generate Links] Search queries: ${JSON.stringify(searchQueries)}`)

  const hyperlinks = await fetchHyperlinks(searchQueries)
  return formatHyperlinks(hyperlinks)
}

async function saveNoteHyperlinks(noteId: string, userId: string, hyperlinks: Hyperlink[]): Promise<void> {
  if (hyperlinks.length === 0) return

  try {
    // Check if a Tags tab already exists for this note
    const existingTab = await db.query(
      `SELECT id FROM personal_sticks_tabs WHERE personal_stick_id = $1 AND tab_name = 'Tags'`,
      [noteId]
    )

    const hyperlinksJson = JSON.stringify(hyperlinks)

    if (existingTab.rows.length > 0) {
      // Update existing tab
      await db.query(
        `UPDATE personal_sticks_tabs SET tags = $1, updated_at = NOW() WHERE id = $2`,
        [hyperlinksJson, existingTab.rows[0].id]
      )
      console.log(`[Generate Links] Updated ${hyperlinks.length} hyperlinks in database for note ${noteId}`)
    } else {
      // Insert new tab - include user_id which is required
      await db.query(
        `INSERT INTO personal_sticks_tabs (personal_stick_id, user_id, tab_name, tab_type, tags, tab_order)
         VALUES ($1, $2, 'Tags', 'tags', $3, 99)`,
        [noteId, userId, hyperlinksJson]
      )
      console.log(`[Generate Links] Saved ${hyperlinks.length} hyperlinks to database for note ${noteId}`)
    }
  } catch (err) {
    console.error(`[Generate Links] Error saving hyperlinks to database:`, err)
    // Don't throw - we still want to return the hyperlinks even if save fails
  }
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

export async function POST(req: Request) {
  try {
    const authResult = await validateAndAuthorize()
    if ("error" in authResult) return authResult.error

    const { user } = authResult
    const { topic, noteId } = await req.json()

    console.log(`[Generate Links] Request for note ${noteId}, topic: "${topic}"`)

    const inputError = validateInput(topic)
    if (inputError) return inputError

    const hyperlinks = await generateHyperlinks(topic.trim())
    console.log(`[Generate Links] Generated ${hyperlinks.length} hyperlinks`)

    // Save hyperlinks to database if noteId is provided
    if (noteId && hyperlinks.length > 0) {
      await saveNoteHyperlinks(noteId, user.id, hyperlinks)
    }

    // Return both tags (empty) and hyperlinks for backward compatibility
    return NextResponse.json({
      tags: [],
      hyperlinks,
      provider: "searxng",
      message: hyperlinks.length === 0 ? "No links found for this topic." : undefined,
    })
  } catch (error) {
    return handleError(error)
  }
}

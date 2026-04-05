import { NextResponse } from "next/server"
import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from "@/lib/auth/cached-auth"

type Hyperlink = { url: string; title: string }

async function fetchSearXNGResults(query: string): Promise<Hyperlink[]> {
  const searxngUrl = process.env.SEARXNG_URL || "https://searx.be"

  try {
    const response = await fetch(
      `${searxngUrl}/search?q=${encodeURIComponent(query)}&format=json&categories=general`,
      {
        headers: {
          Accept: "application/json",
        },
      },
    )

    if (!response.ok) {
      console.warn(`[AI Generate Links] SearXNG returned status ${response.status}`)
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

    return hyperlinks.slice(0, 5)
  } catch (fetchError) {
    console.error("[AI Generate Links] SearXNG fetch error:", fetchError)
    return []
  }
}

function generateSearchQueries(topic: string, content: string): string[] {
  const queries: string[] = []

  if (topic?.trim()) {
    queries.push(topic.trim(), `${topic.trim()} tutorial`)
  }

  if (content?.trim()) {
    const firstPhrase = content.trim().substring(0, 100).split(/[.!?]/)[0]?.trim()
    if (firstPhrase && firstPhrase.length > 5 && !queries.includes(firstPhrase)) {
      queries.push(firstPhrase)
    }
  }

  return queries.slice(0, 3)
}

/**
 * Simplified link generation endpoint using SearXNG.
 * For full functionality use /api/generate-tags instead.
 */
export async function POST(request: Request) {
  try {
    const { user, error: authError } = await getCachedAuthUser()

    if (authError === "rate_limited") {
      return createRateLimitResponse()
    }

    if (!user) {
      return createUnauthorizedResponse()
    }

    const { content, topic } = await request.json()

    if (!content && !topic) {
      return NextResponse.json({ error: "Content or topic is required" }, { status: 400 })
    }

    const searchQueries = generateSearchQueries(topic || "", content || "")
    const searchPromises = searchQueries.map((query) => fetchSearXNGResults(query))
    const searchResults = await Promise.all(searchPromises)

    // Deduplicate by URL
    const seen = new Set<string>()
    const hyperlinks: Hyperlink[] = []
    for (const result of searchResults.flat()) {
      if (!seen.has(result.url)) {
        seen.add(result.url)
        hyperlinks.push({
          url: result.url.startsWith("http") ? result.url : `https://${result.url}`,
          title: result.title,
        })
      }
    }

    return NextResponse.json({
      tags: [],
      hyperlinks: hyperlinks.slice(0, 8),
    })
  } catch (error) {
    if (error instanceof Error && error.message === "RATE_LIMITED") {
      return createRateLimitResponse()
    }
    console.error("[AI Generate Links] Error:", error)
    return NextResponse.json({ error: "Failed to generate links" }, { status: 500 })
  }
}

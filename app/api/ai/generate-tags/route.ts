import { NextResponse } from "next/server"
import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from "@/lib/auth/cached-auth"
import {
  fetchSearXNGResults,
  formatHyperlinks,
  deduplicateByUrl,
} from "@/lib/handlers/stick-generate-tags-handler"

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
    const hyperlinks = formatHyperlinks(deduplicateByUrl(searchResults.flat())).slice(0, 8)

    return NextResponse.json({
      tags: [],
      hyperlinks,
    })
  } catch (error) {
    if (error instanceof Error && error.message === "RATE_LIMITED") {
      return createRateLimitResponse()
    }
    console.error("[AI Generate Links] Error:", error)
    return NextResponse.json({ error: "Failed to generate links" }, { status: 500 })
  }
}

// Shared handler logic for stick generate-tags / generate-links (v1 + v2 deduplication)

export type Hyperlink = { url: string; title: string }

// Normalize hyperlink URLs to ensure they start with http(s)
export function formatHyperlinks(hyperlinks: Hyperlink[]): Hyperlink[] {
  return hyperlinks.map((link) => ({
    url: link.url.startsWith("http") ? link.url : `https://${link.url}`,
    title: link.title,
  }))
}

// Deduplicate hyperlinks by URL
export function deduplicateByUrl(results: Hyperlink[]): Hyperlink[] {
  const seen = new Set<string>()
  const unique: Hyperlink[] = []
  for (const result of results) {
    if (!seen.has(result.url)) {
      seen.add(result.url)
      unique.push(result)
    }
  }
  return unique
}

// Validate that topic or content is present
export function validateGenerateTagsInput(topic: string | undefined, content: string | undefined): string | null {
  if (!topic && !content) {
    return "Missing topic or content"
  }
  const noteText = `${topic || ""} ${content || ""}`.trim()
  if (!noteText) {
    return "No content to analyze"
  }
  return null
}

// Build the combined note text from topic + content
export function buildNoteText(topic: string | undefined, content: string | undefined): string {
  return `${topic || ""} ${content || ""}`.trim()
}

// Parse a JSON array response from AI, with fallback
export function parseJsonArrayResponse(response: string, fallback: string[] = []): string[] {
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

// Query SearXNG for general-category results matching a single query.
// Returns up to 5 hyperlinks. Returns [] on any network/parse failure.
export async function fetchSearXNGResults(query: string): Promise<Hyperlink[]> {
  const searxngUrl = process.env.SEARXNG_URL || "https://searx.be"

  try {
    const response = await fetch(
      `${searxngUrl}/search?q=${encodeURIComponent(query)}&format=json&categories=general`,
      { headers: { Accept: "application/json" } },
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

    return hyperlinks.slice(0, 5)
  } catch (fetchError) {
    console.error("[Generate Links] SearXNG fetch error:", fetchError)
    return []
  }
}

// Run up to 3 SearXNG queries in parallel and return a deduped, capped list.
export async function fetchHyperlinks(searchQueries: string[]): Promise<Hyperlink[]> {
  if (searchQueries.length === 0) return []

  try {
    const searchPromises = searchQueries.slice(0, 3).map((query) => fetchSearXNGResults(query))
    const searchResults = await Promise.all(searchPromises)
    return deduplicateByUrl(searchResults.flat()).slice(0, 8)
  } catch (error) {
    console.error("[Generate Links] Error fetching hyperlinks:", error)
    return []
  }
}

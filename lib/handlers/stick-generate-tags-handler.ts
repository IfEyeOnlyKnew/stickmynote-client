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

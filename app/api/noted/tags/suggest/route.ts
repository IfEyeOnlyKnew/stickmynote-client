import { type NextRequest, NextResponse } from "next/server"
import { applyRateLimit } from "@/lib/rate-limiter-enhanced"
import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from "@/lib/auth/cached-auth"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { db as pgClient } from "@/lib/database/pg-client"

async function safeRateLimit(request: NextRequest, userId: string, action: string) {
  try {
    const res = await applyRateLimit(request, userId, action)
    return res.success
  } catch {
    return true
  }
}

// POST /api/noted/tags/suggest - AI-powered tag suggestions
export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await getCachedAuthUser()
    if (authError === "rate_limited") return createRateLimitResponse()
    if (!user) return createUnauthorizedResponse()

    const orgContext = await getOrgContext()
    if (!orgContext) return NextResponse.json({ error: "No organization context" }, { status: 403 })

    const allowed = await safeRateLimit(request, user.id, "noted_tag_suggest")
    if (!allowed) return createRateLimitResponse()

    const body = await request.json()
    const { title, content } = body

    if (!title && !content) {
      return NextResponse.json({ error: "Title or content required" }, { status: 400 })
    }

    // Strip HTML from content for analysis
    const plainContent = (content || "").replace(/<[^>]*>/g, "").slice(0, 2000)
    const textForAnalysis = `Title: ${title || "Untitled"}\n\nContent: ${plainContent}`

    // Get existing tags for context
    const existingTags = await pgClient.query(
      `SELECT name FROM noted_tags WHERE org_id = $1 ORDER BY name`,
      [orgContext.orgId]
    )
    const existingTagNames = existingTags.rows.map((t: { name: string }) => t.name)

    // Call Ollama for tag suggestions
    const ollamaUrl = process.env.OLLAMA_URL || "http://192.168.50.70:11434"

    const prompt = `Analyze the following note and suggest 3-5 relevant tags for categorization.
${existingTagNames.length > 0 ? `\nExisting tags in the system: ${existingTagNames.join(", ")}. Prefer using existing tags when relevant, but suggest new ones if needed.` : ""}

Note:
${textForAnalysis}

Respond with ONLY a JSON array of tag names, e.g. ["tag1", "tag2", "tag3"]. Keep tags lowercase, 1-3 words each. No explanation.`

    try {
      const ollamaRes = await fetch(`${ollamaUrl}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "llama3.2",
          prompt,
          stream: false,
          options: { temperature: 0.3, num_predict: 100 },
        }),
      })

      if (!ollamaRes.ok) throw new Error("Ollama request failed")

      const ollamaData = await ollamaRes.json()
      const responseText = ollamaData.response || ""

      // Parse JSON array from response
      const match = responseText.match(/\[[\s\S]*?\]/)
      if (match) {
        const suggestedTags: string[] = JSON.parse(match[0])
        const cleanTags = suggestedTags
          .filter((t): t is string => typeof t === "string" && t.trim().length > 0)
          .map((t) => t.trim().toLowerCase())
          .slice(0, 5)

        return NextResponse.json({
          data: {
            suggestions: cleanTags,
            existing: existingTagNames,
          },
        })
      }
    } catch (ollamaErr) {
      console.error("Ollama tag suggestion failed, using fallback:", ollamaErr)
    }

    // Fallback: simple keyword extraction if Ollama is unavailable
    const words = plainContent.toLowerCase().split(/\W+/).filter((w) => w.length > 4)
    const freq: Record<string, number> = {}
    for (const w of words) {
      freq[w] = (freq[w] || 0) + 1
    }
    const topWords = Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word]) => word)

    return NextResponse.json({
      data: {
        suggestions: topWords,
        existing: existingTagNames,
        fallback: true,
      },
    })
  } catch (err) {
    console.error("Failed to suggest tags:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

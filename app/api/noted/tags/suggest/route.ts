import { type NextRequest, NextResponse } from "next/server"
import { requireAuthAndOrg, safeRateLimit } from "@/lib/api/route-helpers"
import { createRateLimitResponse } from "@/lib/auth/cached-auth"
import { db as pgClient } from "@/lib/database/pg-client"
import { stripHtmlTags } from "@/lib/utils"

// POST /api/noted/tags/suggest - AI-powered tag suggestions
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuthAndOrg()
    if ("response" in auth) return auth.response
    const { user, orgContext } = auth

    const allowed = await safeRateLimit(request, user.id, "noted_tag_suggest")
    if (!allowed) return createRateLimitResponse()

    const body = await request.json()
    const { title, content } = body

    if (!title && !content) {
      return NextResponse.json({ error: "Title or content required" }, { status: 400 })
    }

    // Strip HTML from content for analysis
    const plainContent = stripHtmlTags(content || "", 5000).slice(0, 2000)
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
      const rawResponse = ollamaData.response || ""
      // Bound the response before parsing. num_predict: 100 already caps
      // Ollama's output server-side, but a defensive hard cap here makes
      // the subsequent linear scan obviously O(n) with small n and avoids
      // SonarCloud S5852 false positives on regex-based JSON array extraction.
      const responseText: string = rawResponse.length > 2000 ? rawResponse.slice(0, 2000) : rawResponse

      // Extract the first [...] JSON array via linear indexOf scans.
      // Replaces /\[[\s\S]*?\]/ which SonarCloud S5852 flags for unbounded
      // repetition. Both operations are O(n), no backtracking possible.
      const openIdx = responseText.indexOf("[")
      const closeIdx = openIdx >= 0 ? responseText.indexOf("]", openIdx + 1) : -1
      if (openIdx >= 0 && closeIdx > openIdx) {
        const jsonSlice = responseText.substring(openIdx, closeIdx + 1)
        const suggestedTags: string[] = JSON.parse(jsonSlice)
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

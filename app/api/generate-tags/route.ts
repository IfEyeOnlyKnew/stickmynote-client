import { NextResponse } from "next/server"
import { generateText } from "ai"
import { xai } from "@ai-sdk/xai"
import { createClient } from "@/lib/supabase/server"
import { applyRateLimit } from "@/lib/rate-limiter-enhanced"
import { Redis } from "@upstash/redis"
import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from "@/lib/auth/cached-auth"
import { getOrgContext } from "@/lib/auth/get-org-context"

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
})

function getCacheKey(topic: string, orgId: string): string {
  return `tags:${orgId}:${Buffer.from(topic).toString("base64").slice(0, 50)}`
}

export async function POST(req: Request) {
  try {
    const { user, error: authError } = await getCachedAuthUser()

    if (authError === "rate_limited") {
      return createRateLimitResponse()
    }

    if (!user) {
      return createUnauthorizedResponse("Unauthorized. Please log in to generate tags.")
    }

    const orgContext = await getOrgContext(user.id)
    if (!orgContext) {
      return NextResponse.json({ error: "No organization context" }, { status: 403 })
    }

    const rateLimitResult = await applyRateLimit(req, user.id, "ai_generate_tags")
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: "Too many tag generation requests. Please try again later." },
        {
          status: 429,
          headers: {
            "Retry-After": "60",
            ...rateLimitResult.headers,
          },
        },
      )
    }

    const { topic, noteId, isTeamNote } = await req.json()

    if (!topic || !topic.trim()) {
      return NextResponse.json({ error: "Missing topic" }, { status: 400 })
    }

    if (!noteId) {
      return NextResponse.json({ error: "Missing noteId" }, { status: 400 })
    }

    if (!process.env.XAI_API_KEY) {
      return NextResponse.json({ error: "XAI_API_KEY not configured" }, { status: 500 })
    }

    const noteText = topic.trim()

    const cacheKey = getCacheKey(noteText, orgContext.orgId)
    try {
      const cached = await redis.get(cacheKey)
      if (cached && typeof cached === "object") {
        return NextResponse.json(cached)
      }
    } catch (cacheError) {
      console.warn("Cache read error:", cacheError)
    }

    const tagsResult = await generateText({
      model: xai("grok-3"),
      prompt: `Analyze the following note content and generate 3-5 relevant tags that categorize the main topics, themes, or subjects discussed. Return only the tags as a JSON array of strings, no additional text or formatting.

Note content: "${noteText}"

Example response format: ["technology", "productivity", "planning"]`,
    })

    const tagsResponse = tagsResult.text || "[]"

    let tags: string[] = []
    try {
      tags = JSON.parse(tagsResponse.trim())
      if (Array.isArray(tags)) {
        tags = tags
          .filter((tag) => typeof tag === "string" && tag.trim().length > 0)
          .map((tag) => tag.trim().toLowerCase())
          .slice(0, 5)
      } else {
        throw new Error("Response is not an array")
      }
    } catch (parseError) {
      const words = tagsResponse.toLowerCase().match(/\b\w+\b/g) || []
      tags = words.slice(0, 3)
    }

    const searchQueriesResult = await generateText({
      model: xai("grok-3"),
      prompt: `Based on the following note content, generate 3-5 specific search queries that would help find relevant, useful websites and resources. Focus on actionable, informative content rather than generic searches.

Note content: "${noteText}"

Return only a JSON array of search query strings, no additional text.

Example response format: ["react hooks tutorial", "javascript best practices 2024", "web development tools"]`,
    })

    const searchQueriesResponse = searchQueriesResult.text || "[]"

    let searchQueries: string[] = []
    try {
      searchQueries = JSON.parse(searchQueriesResponse.trim())
      if (Array.isArray(searchQueries)) {
        searchQueries = searchQueries
          .filter((query) => typeof query === "string" && query.trim().length > 0)
          .map((query) => query.trim())
          .slice(0, 5)
      }
    } catch (parseError) {
      searchQueries = tags.map((tag) => `${tag} tutorial guide`)
    }

    let hyperlinks: { url: string; title: string }[] = []

    if (process.env.BRAVE_API_KEY && searchQueries.length > 0) {
      try {
        const searchPromises = searchQueries.slice(0, 2).map(async (query, index) => {
          if (index > 0) {
            await new Promise((resolve) => setTimeout(resolve, 1100))
          }

          let retries = 0
          const maxRetries = 2

          while (retries <= maxRetries) {
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

              if (response.status === 429) {
                if (retries < maxRetries) {
                  const waitTime = Math.pow(2, retries) * 1000
                  await new Promise((resolve) => setTimeout(resolve, waitTime))
                  retries++
                  continue
                } else {
                  return []
                }
              }

              if (!response.ok) {
                return []
              }

              const data = await response.json()
              const results = (data.web?.results || []).map((result: { url: string; title?: string }) => ({
                url: result.url,
                title: result.title || result.url,
              }))

              return results
            } catch (fetchError) {
              if (retries < maxRetries) {
                retries++
                await new Promise((resolve) => setTimeout(resolve, 1000))
                continue
              }
              return []
            }
          }
          return []
        })

        const searchResults = await Promise.all(searchPromises)
        hyperlinks = searchResults.flat().slice(0, 8)
      } catch (error) {
        console.error("Error fetching from Brave API:", error)
        hyperlinks = []
      }
    }

    const formattedHyperlinks = hyperlinks.map((link) => ({
      url: link.url.startsWith("http") ? link.url : `https://${link.url}`,
      title: link.title,
    }))

    if (tags.length === 0 && formattedHyperlinks.length === 0) {
      return NextResponse.json({
        tags: [],
        hyperlinks: [],
        message: "Unable to generate tags or hyperlinks at this time.",
      })
    }

    const resultToCache = { tags, hyperlinks: formattedHyperlinks }
    try {
      await redis.set(cacheKey, JSON.stringify(resultToCache), { ex: 86400 })
    } catch (cacheError) {
      console.warn("Cache write error:", cacheError)
    }

    const supabase = await createClient()

    if (isTeamNote && (tags.length > 0 || formattedHyperlinks.length > 0)) {
      if (tags.length > 0) {
        await supabase.from("team_note_tags").delete().eq("team_note_id", noteId).eq("org_id", orgContext.orgId)

        const tagInserts = tags.map((tag, index) => ({
          team_note_id: noteId,
          user_id: user.id,
          tag_title: tag,
          tag_content: tag,
          tag_order: index + 1,
          org_id: orgContext.orgId,
        }))

        const { error: insertError } = await supabase.from("team_note_tags").insert(tagInserts)
        if (insertError) {
          console.warn("Error saving team note tags:", insertError)
        }
      }

      if (formattedHyperlinks.length > 0) {
        const { data: existingTab } = await supabase
          .from("team_note_tabs")
          .select("id")
          .eq("team_note_id", noteId)
          .eq("tab_name", "Links")
          .eq("org_id", orgContext.orgId)
          .maybeSingle()

        if (existingTab) {
          const { error: updateError } = await supabase
            .from("team_note_tabs")
            .update({
              tab_data: JSON.stringify({ hyperlinks: formattedHyperlinks }),
              updated_at: new Date().toISOString(),
            })
            .eq("id", existingTab.id)

          if (updateError) {
            console.warn("Error updating team note hyperlinks:", updateError)
          }
        } else {
          const { error: insertError } = await supabase.from("team_note_tabs").insert({
            team_note_id: noteId,
            user_id: user.id,
            tab_name: "Links",
            tab_type: "content",
            tab_content: "",
            tab_data: JSON.stringify({ hyperlinks: formattedHyperlinks }),
            tab_order: 98,
            org_id: orgContext.orgId,
          })

          if (insertError) {
            console.warn("Error creating team note Links tab:", insertError)
          }
        }
      }
    }

    return NextResponse.json({ tags, hyperlinks: formattedHyperlinks })
  } catch (error) {
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
}

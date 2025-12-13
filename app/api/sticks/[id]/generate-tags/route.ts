import { NextResponse } from "next/server"
import { generateText } from "ai"
import { xai } from "@ai-sdk/xai"
import { createClient } from "@/lib/supabase/server"
import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from "@/lib/auth/cached-auth"

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const { topic, content } = await req.json()
    const stickId = params.id

    if (!topic && !content) {
      return NextResponse.json({ error: "Missing topic or content" }, { status: 400 })
    }

    if (!process.env.XAI_API_KEY) {
      return NextResponse.json({ error: "XAI_API_KEY not configured" }, { status: 500 })
    }

    const { user, error: authError } = await getCachedAuthUser()

    if (authError === "rate_limited") {
      return createRateLimitResponse()
    }

    if (!user) {
      return createUnauthorizedResponse()
    }

    const supabase = await createClient()

    const { data: stick, error: stickError } = await supabase
      .from("paks_pad_sticks")
      .select("user_id")
      .eq("id", stickId)
      .maybeSingle()

    if (stickError || !stick) {
      return NextResponse.json({ error: "Stick not found" }, { status: 404 })
    }

    if (stick.user_id !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    const noteText = `${topic || ""} ${content || ""}`.trim()

    if (!noteText) {
      return NextResponse.json({ error: "No content to analyze" }, { status: 400 })
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
        const searchPromises = searchQueries.slice(0, 2).map(async (query) => {
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

    if (tags.length > 0 || formattedHyperlinks.length > 0) {
      if (tags.length > 0) {
        const { data: existingTagsTab } = await supabase
          .from("paks_pad_stick_tabs")
          .select("id")
          .eq("stick_id", stickId)
          .eq("tab_type", "tags")
          .maybeSingle()

        if (existingTagsTab) {
          await supabase
            .from("paks_pad_stick_tabs")
            .update({
              tab_data: JSON.stringify({ tags }),
              updated_at: new Date().toISOString(),
            })
            .eq("id", existingTagsTab.id)
        } else {
          await supabase.from("paks_pad_stick_tabs").insert({
            stick_id: stickId,
            user_id: user.id,
            tab_name: "Tags",
            tab_type: "tags",
            tab_content: "",
            tab_data: JSON.stringify({ tags }),
            tab_order: 97,
          })
        }
      }

      if (formattedHyperlinks.length > 0) {
        const { data: existingLinksTab } = await supabase
          .from("paks_pad_stick_tabs")
          .select("id")
          .eq("stick_id", stickId)
          .eq("tab_type", "links")
          .maybeSingle()

        if (existingLinksTab) {
          await supabase
            .from("paks_pad_stick_tabs")
            .update({
              tab_data: JSON.stringify({ hyperlinks: formattedHyperlinks }),
              updated_at: new Date().toISOString(),
            })
            .eq("id", existingLinksTab.id)
        } else {
          await supabase.from("paks_pad_stick_tabs").insert({
            stick_id: stickId,
            user_id: user.id,
            tab_name: "Links",
            tab_type: "links",
            tab_content: "",
            tab_data: JSON.stringify({ hyperlinks: formattedHyperlinks }),
            tab_order: 98,
          })
        }
      }
    }

    return NextResponse.json({
      tags,
      hyperlinks: formattedHyperlinks,
      message:
        tags.length === 0 && formattedHyperlinks.length === 0
          ? "Having issues now or no results to display at this time."
          : undefined,
    })
  } catch (error) {
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
}

// v2 Sticks Generate Tags API: production-quality, AI tag generation
import { type NextRequest } from 'next/server'
import { db } from '@/lib/database/pg-client'
import { getCachedAuthUser } from '@/lib/auth/cached-auth'
import { handleApiError } from '@/lib/api/handle-api-error'
import { isAIAvailable, generateText } from '@/lib/ai/ai-provider'
import {
  type Hyperlink,
  formatHyperlinks,
  validateGenerateTagsInput,
  buildNoteText,
  parseJsonArrayResponse,
} from '@/lib/handlers/stick-generate-tags-handler'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

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

async function fetchBraveSearch(query: string, maxRetries = 2): Promise<Hyperlink[]> {
  if (!process.env.BRAVE_API_KEY) return []

  for (let retries = 0; retries <= maxRetries; retries++) {
    try {
      const response = await fetch(
        `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=3`,
        {
          headers: {
            'X-Subscription-Token': process.env.BRAVE_API_KEY,
            Accept: 'application/json',
          },
        }
      )

      if (response.status === 429 && retries < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, Math.pow(2, retries) * 1000))
        continue
      }

      if (!response.ok) return []

      const data = await response.json()
      return (data.web?.results || []).map((result: any) => ({
        url: result.url,
        title: result.title || result.url,
      }))
    } catch {
      if (retries < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 1000))
        continue
      }
    }
  }
  return []
}

async function fetchHyperlinks(searchQueries: string[]): Promise<Hyperlink[]> {
  if (searchQueries.length === 0) return []

  const searchPromises = searchQueries.slice(0, 2).map((query) => fetchBraveSearch(query))
  const searchResults = await Promise.all(searchPromises)
  return searchResults.flat().slice(0, 8)
}

// Auth + ownership guard: returns user or an error Response
async function authenticateAndCheckOwnership(
  stickId: string,
): Promise<{ user: any } | { error: Response }> {
  const authResult = await getCachedAuthUser()
  if (authResult.rateLimited) {
    return {
      error: new Response(
        JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }),
        { status: 429, headers: { 'Retry-After': '30' } }
      ),
    }
  }
  if (!authResult.user) {
    return { error: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }) }
  }

  const stickResult = await db.query(
    `SELECT user_id FROM paks_pad_sticks WHERE id = $1`,
    [stickId]
  )

  if (stickResult.rows.length === 0) {
    return { error: new Response(JSON.stringify({ error: 'Stick not found' }), { status: 404 }) }
  }

  if (stickResult.rows[0].user_id !== authResult.user.id) {
    return { error: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 403 }) }
  }

  return { user: authResult.user }
}

async function saveTags(stickId: string, userId: string, tags: string[]): Promise<void> {
  if (tags.length === 0) return

  const existingTagsTab = await db.query(
    `SELECT id FROM paks_pad_stick_tabs WHERE stick_id = $1 AND tab_type = 'tags'`,
    [stickId]
  )

  if (existingTagsTab.rows.length > 0) {
    await db.query(
      `UPDATE paks_pad_stick_tabs SET tab_data = $1, updated_at = NOW() WHERE id = $2`,
      [JSON.stringify({ tags }), existingTagsTab.rows[0].id]
    )
  } else {
    await db.query(
      `INSERT INTO paks_pad_stick_tabs (stick_id, user_id, tab_name, tab_type, tab_content, tab_data, tab_order)
       VALUES ($1, $2, 'Tags', 'tags', '', $3, 97)`,
      [stickId, userId, JSON.stringify({ tags })]
    )
  }
}

async function saveHyperlinks(stickId: string, userId: string, hyperlinks: Hyperlink[]): Promise<void> {
  if (hyperlinks.length === 0) return

  const existingLinksTab = await db.query(
    `SELECT id FROM paks_pad_stick_tabs WHERE stick_id = $1 AND tab_type = 'links'`,
    [stickId]
  )

  if (existingLinksTab.rows.length > 0) {
    await db.query(
      `UPDATE paks_pad_stick_tabs SET tab_data = $1, updated_at = NOW() WHERE id = $2`,
      [JSON.stringify({ hyperlinks }), existingLinksTab.rows[0].id]
    )
  } else {
    await db.query(
      `INSERT INTO paks_pad_stick_tabs (stick_id, user_id, tab_name, tab_type, tab_content, tab_data, tab_order)
       VALUES ($1, $2, 'Links', 'links', '', $3, 98)`,
      [stickId, userId, JSON.stringify({ hyperlinks })]
    )
  }
}

// POST /api/v2/sticks/[id]/generate-tags - Generate AI tags and hyperlinks
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: stickId } = await params
    const { topic, content } = await request.json()

    const inputError = validateGenerateTagsInput(topic, content)
    if (inputError) {
      return new Response(JSON.stringify({ error: inputError }), { status: 400 })
    }

    if (!isAIAvailable()) {
      return new Response(JSON.stringify({ error: 'AI service not configured' }), { status: 500 })
    }

    const authGuard = await authenticateAndCheckOwnership(stickId)
    if ('error' in authGuard) return authGuard.error
    const user = authGuard.user

    const noteText = buildNoteText(topic, content)

    // Generate tags
    const tagsResult = await generateText({
      prompt: `Analyze the following note content and generate 3-5 relevant tags. Return only the tags as a JSON array of strings.

Note content: "${noteText}"

Example response format: ["technology", "productivity", "planning"]`,
    })
    const tags = parseTags(tagsResult.text || '[]')

    // Generate search queries
    const searchQueriesResult = await generateText({
      prompt: `Based on the following note content, generate 3-5 specific search queries that would help find relevant resources.

Note content: "${noteText}"

Return only a JSON array of search query strings.

Example response format: ["react hooks tutorial", "javascript best practices 2024"]`,
    })
    const searchQueries = parseSearchQueries(searchQueriesResult.text || '[]', tags)

    // Fetch hyperlinks
    const hyperlinks = await fetchHyperlinks(searchQueries)
    const formattedHyperlinks = formatHyperlinks(hyperlinks)

    // Save tags and hyperlinks
    await saveTags(stickId, user.id, tags)
    await saveHyperlinks(stickId, user.id, formattedHyperlinks)

    return new Response(
      JSON.stringify({
        tags,
        hyperlinks: formattedHyperlinks,
        message: tags.length === 0 && formattedHyperlinks.length === 0
          ? 'No results to display at this time.'
          : undefined,
      }),
      { status: 200 }
    )
  } catch (error) {
    return handleApiError(error)
  }
}

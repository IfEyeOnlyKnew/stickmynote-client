import "server-only"
import { db } from "@/lib/database/pg-client"
import { generateText } from "@/lib/ai/ai-provider"
import type {
  HostedArticleData,
  HostedArticleSection,
  HostedArticleSectionItem,
  HostedArticleReply,
} from "@/components/hosted/HostedArticle"

function randomSlug(topic: string): string {
  const slugBase = (topic || "stick")
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/(^-|-$)/g, "")
    .slice(0, 48)
  const suffix = Math.random().toString(36).slice(2, 8)
  return `${slugBase || "stick"}-${suffix}`
}

interface StickRow {
  id: string
  user_id: string
  topic: string | null
  content: string | null
  color: string | null
  created_at: string
  updated_at: string | null
  org_id: string | null
}

interface TabRow {
  id: string
  tab_name: string | null
  tab_type: string | null
  tab_content: string | null
  tab_data: any
  tags: any
  tab_order: number
}

interface ReplyRow {
  id: string
  content: string
  created_at: string
  user_id: string
  parent_reply_id: string | null
  full_name: string | null
  email: string | null
}

function tabItemsFromRow(tab: TabRow): HostedArticleSectionItem[] {
  const items: HostedArticleSectionItem[] = []

  // Hyperlinks stored in `tags` JSONB (common pattern for Tags tab)
  if (tab.tags) {
    const links = Array.isArray(tab.tags) ? tab.tags : []
    for (const link of links) {
      if (link?.url) {
        items.push({
          type: "link",
          title: link.title || link.url,
          description: link.summary || link.description,
          url: link.url,
        })
      }
    }
  }

  // tab_data can be array of items
  if (Array.isArray(tab.tab_data)) {
    for (const d of tab.tab_data) {
      if (d?.url && /(mp4|webm|youtube|youtu\.be|vimeo)/i.test(String(d.url))) {
        items.push({ type: "video", url: d.url, caption: d.caption || d.title })
      } else if (d?.url && /(jpg|jpeg|png|gif|webp|svg)/i.test(String(d.url))) {
        items.push({ type: "image", url: d.url, caption: d.caption || d.title })
      } else if (d?.url) {
        items.push({ type: "link", title: d.title, url: d.url, description: d.description })
      }
    }
  }

  // tab_content as prose fallback
  if (tab.tab_content && items.length === 0) {
    items.push({ type: "prose", html: tab.tab_content })
  }

  return items
}

function buildReplyTree(rows: ReplyRow[]): HostedArticleReply[] {
  const byId = new Map<string, HostedArticleReply>()
  const roots: HostedArticleReply[] = []

  for (const r of rows) {
    byId.set(r.id, {
      id: r.id,
      author: r.full_name || r.email || "User",
      createdAt: r.created_at,
      body: r.content,
      replies: [],
    })
  }
  for (const r of rows) {
    const node = byId.get(r.id)!
    if (r.parent_reply_id && byId.has(r.parent_reply_id)) {
      byId.get(r.parent_reply_id)!.replies!.push(node)
    } else {
      roots.push(node)
    }
  }
  return roots
}

async function askOllamaForNarrative(stick: StickRow, sections: HostedArticleSection[]): Promise<{
  deck: string
  lead: string
  sectionLeadIns: string[]
  sectionClosings: string[]
  discussionHeading: string
}> {
  const tabSummaries = sections
    .map((s, i) => `Section ${i + 1} "${s.tabName}" — ${s.items.length} item(s)`)
    .join("\n")

  const prompt = `You are writing narrative connective text for an online article generated from a user's note ("Stick").
Return STRICT JSON — no prose, no markdown fences — with this exact shape:
{
  "deck": "one sentence subtitle that sets up the article",
  "lead": "2-3 sentence opening paragraph",
  "sectionLeadIns": ["one short lead-in sentence per section, in order"],
  "sectionClosings": ["one short closing/transition sentence per section, in order"],
  "discussionHeading": "a short heading for the reader discussion section, like 'What readers are saying'"
}

Stick topic: ${stick.topic || "Untitled"}
Stick content:
${stick.content || "(no body)"}

Sections:
${tabSummaries || "(none)"}

Keep tone warm, clear, journalistic. Lead-ins and closings should flow naturally into and out of the section content.`

  const fallback = {
    deck: stick.topic || "A note worth sharing",
    lead: stick.content?.slice(0, 280) || "",
    sectionLeadIns: sections.map(() => ""),
    sectionClosings: sections.map(() => ""),
    discussionHeading: "Discussion",
  }

  try {
    const { text } = await generateText({
      prompt,
      maxTokens: 800,
      temperature: 0.6,
    })
    const match = /\{[\s\S]*\}/.exec(text)
    if (!match) return fallback
    const parsed = JSON.parse(match[0])
    return {
      deck: String(parsed.deck || fallback.deck),
      lead: String(parsed.lead || fallback.lead),
      sectionLeadIns: Array.isArray(parsed.sectionLeadIns)
        ? parsed.sectionLeadIns.map(String)
        : fallback.sectionLeadIns,
      sectionClosings: Array.isArray(parsed.sectionClosings)
        ? parsed.sectionClosings.map(String)
        : fallback.sectionClosings,
      discussionHeading: String(parsed.discussionHeading || fallback.discussionHeading),
    }
  } catch (err) {
    console.warn("[HostedPage] Ollama narrative generation failed, using fallback:", err)
    return fallback
  }
}

export interface GenerateHostedPageResult {
  slug: string
  articleData: HostedArticleData
}

export async function generateHostedPageForPersonalStick(
  stickId: string,
  userId: string,
  origin: string,
): Promise<GenerateHostedPageResult | { error: string; status: number }> {
  const stickResult = await db.query<StickRow>(
    `SELECT id, user_id, topic, content, color, created_at, updated_at, org_id
     FROM personal_sticks WHERE id = $1 LIMIT 1`,
    [stickId],
  )
  const stick = stickResult.rows[0]
  if (!stick) return { error: "Stick not found", status: 404 }
  if (stick.user_id !== userId) return { error: "Not authorized", status: 403 }

  const tabsResult = await db.query<TabRow>(
    `SELECT id, tab_name, tab_type, tab_content, tab_data, tags, tab_order
     FROM personal_sticks_tabs
     WHERE personal_stick_id = $1
     ORDER BY tab_order ASC, created_at ASC`,
    [stickId],
  )

  const repliesResult = await db.query<ReplyRow>(
    `SELECT r.id, r.content, r.created_at, r.user_id, r.parent_reply_id, u.full_name, u.email
     FROM personal_sticks_replies r
     LEFT JOIN users u ON u.id = r.user_id
     WHERE r.personal_stick_id = $1
     ORDER BY r.created_at ASC`,
    [stickId],
  )

  const authorResult = await db.query<{ full_name: string | null; email: string }>(
    `SELECT full_name, email FROM users WHERE id = $1 LIMIT 1`,
    [stick.user_id],
  )
  const author = authorResult.rows[0]

  const sectionsSkeleton: HostedArticleSection[] = tabsResult.rows.map((tab) => ({
    tabName: tab.tab_name || "Untitled Section",
    items: tabItemsFromRow(tab),
  }))

  // Attach the Noted page (if any) as its own section
  const notedResult = await db.query<{ title: string; content: string; updated_at: string }>(
    `SELECT title, content, updated_at FROM noted_pages WHERE personal_stick_id = $1 LIMIT 1`,
    [stickId],
  )
  const noted = notedResult.rows[0]
  if (noted && (noted.content || noted.title)) {
    sectionsSkeleton.push({
      tabName: noted.title?.trim() || "Noted",
      items: [{ type: "prose", html: noted.content || "" }],
    })
  }

  // Attach any chat rooms linked to this stick
  const chatResult = await db.query<{ id: string; name: string | null; is_group: boolean }>(
    `SELECT id, name, is_group FROM stick_chats
     WHERE stick_id = $1 AND stick_type = 'personal'
     ORDER BY created_at ASC`,
    [stickId],
  )
  if (chatResult.rows.length > 0) {
    sectionsSkeleton.push({
      tabName: "Chat Rooms",
      items: chatResult.rows.map((c) => ({
        type: "link" as const,
        title: c.name || (c.is_group ? "Group chat" : "Direct chat"),
        description: c.is_group ? "Group chat room" : "One-on-one chat",
        url: `${origin}/chat/${c.id}`,
      })),
    })
  }

  // Attach any video rooms created for this stick (via pad association, if any)
  const videoResult = await db.query<{ id: string; name: string | null; livekit_room_name: string | null }>(
    `SELECT vr.id, vr.name, vr.livekit_room_name
     FROM video_rooms vr
     WHERE vr.livekit_room_name IS NOT NULL
       AND EXISTS (
         SELECT 1 FROM personal_sticks ps
         WHERE ps.id = $1 AND vr.pad_id IS NOT NULL
       )
     ORDER BY vr.created_at ASC`,
    [stickId],
  )
  if (videoResult.rows.length > 0) {
    sectionsSkeleton.push({
      tabName: "Video Rooms",
      items: videoResult.rows.map((v) => ({
        type: "link" as const,
        title: v.name || "Video room",
        description: "Join the LiveKit video session",
        url: `${origin}/video/join/${v.id}`,
      })),
    })
  }

  const narrative = await askOllamaForNarrative(stick, sectionsSkeleton)

  const sections: HostedArticleSection[] = sectionsSkeleton.map((s, i) => ({
    ...s,
    leadIn: narrative.sectionLeadIns[i] || undefined,
    closing: narrative.sectionClosings[i] || undefined,
  }))

  const replyTree = buildReplyTree(repliesResult.rows)

  const articleData: HostedArticleData = {
    masthead: { wordmark: "Stick My Note", tagline: "Hosted from a Stick" },
    hero: {
      topic: stick.topic || "Untitled",
      deck: narrative.deck,
      authorName: author?.full_name || author?.email || "Unknown author",
      createdAt: stick.created_at,
      updatedAt: stick.updated_at || undefined,
      accentColor: stick.color || "#6366f1",
    },
    lead: narrative.lead,
    body: stick.content || undefined,
    sections,
    discussion: replyTree.length > 0 ? { heading: narrative.discussionHeading, replies: replyTree } : undefined,
    footer: {
      stickId: stick.id,
      permalink: "",
      publishedAt: new Date().toISOString(),
    },
  }

  // Reuse existing slug if this stick was already published
  const existing = await db.query<{ slug: string }>(
    `SELECT slug FROM stick_hosted_pages WHERE stick_id = $1 AND stick_kind = 'personal' LIMIT 1`,
    [stickId],
  )
  const slug = existing.rows[0]?.slug || randomSlug(stick.topic || "")
  articleData.footer.permalink = `${origin}/hosted/${slug}`

  if (existing.rows[0]) {
    await db.query(
      `UPDATE stick_hosted_pages
       SET article_data = $1::jsonb, generated_by = $2, updated_at = NOW()
       WHERE stick_id = $3 AND stick_kind = 'personal'`,
      [JSON.stringify(articleData), userId, stickId],
    )
  } else {
    await db.query(
      `INSERT INTO stick_hosted_pages (stick_id, stick_kind, slug, generated_by, article_data)
       VALUES ($1, 'personal', $2, $3, $4::jsonb)`,
      [stickId, slug, userId, JSON.stringify(articleData)],
    )
  }

  return { slug, articleData }
}

export async function getLatestHostedPageForStick(
  stickId: string,
): Promise<{ slug: string; createdAt: string } | null> {
  const result = await db.query<{ slug: string; created_at: string }>(
    `SELECT slug, created_at FROM stick_hosted_pages
     WHERE stick_id = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [stickId],
  )
  const row = result.rows[0]
  return row ? { slug: row.slug, createdAt: row.created_at } : null
}

export async function getHostedPageBySlug(slug: string): Promise<HostedArticleData | null> {
  const result = await db.query<{ article_data: HostedArticleData }>(
    `SELECT article_data FROM stick_hosted_pages WHERE slug = $1 LIMIT 1`,
    [slug],
  )
  return result.rows[0]?.article_data || null
}

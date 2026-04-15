import "server-only"
import { db } from "@/lib/database/pg-client"
import { generateText } from "@/lib/ai/ai-provider"
import type {
  HostedArticleData,
  HostedArticleSection,
  HostedArticleSectionItem,
  HostedArticleReply,
} from "@/components/hosted/HostedArticle"

export type StickKind = "personal" | "pad" | "concur"

interface KindConfig {
  stickTable: string
  tabsTable: string
  tabsFk: string
  repliesTable: string
  repliesFk: string
  hasParentReplyId: boolean
}

const KIND: Record<StickKind, KindConfig> = {
  personal: {
    stickTable: "personal_sticks",
    tabsTable: "personal_sticks_tabs",
    tabsFk: "personal_stick_id",
    repliesTable: "personal_sticks_replies",
    repliesFk: "personal_stick_id",
    hasParentReplyId: true,
  },
  pad: {
    stickTable: "paks_pad_sticks",
    tabsTable: "paks_pad_stick_tabs",
    tabsFk: "stick_id",
    repliesTable: "paks_pad_stick_replies",
    repliesFk: "stick_id",
    hasParentReplyId: false,
  },
  concur: {
    stickTable: "concur_sticks",
    tabsTable: "concur_stick_tabs",
    tabsFk: "stick_id",
    repliesTable: "concur_stick_replies",
    repliesFk: "stick_id",
    hasParentReplyId: true,
  },
}

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
  pad_id?: string | null
  group_id?: string | null
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

// ============================================================================
// Authorization — owner or admin can publish
// ============================================================================

async function canPublish(kind: StickKind, stick: StickRow, userId: string): Promise<boolean> {
  if (stick.user_id === userId) return true

  if (kind === "pad" && stick.pad_id) {
    const padOwner = await db.query<{ owner_id: string }>(
      `SELECT owner_id FROM paks_pads WHERE id = $1 LIMIT 1`,
      [stick.pad_id],
    )
    if (padOwner.rows[0]?.owner_id === userId) return true
    const memberRole = await db.query<{ role: string }>(
      `SELECT role FROM paks_pad_stick_members WHERE stick_id = $1 AND user_id = $2 LIMIT 1`,
      [stick.id, userId],
    )
    return memberRole.rows[0]?.role === "admin"
  }

  if (kind === "concur" && stick.group_id) {
    const groupRole = await db.query<{ role: string }>(
      `SELECT role FROM concur_group_members WHERE group_id = $1 AND user_id = $2 LIMIT 1`,
      [stick.group_id, userId],
    )
    return groupRole.rows[0]?.role === "owner"
  }

  return false
}

// ============================================================================
// Tab → article items
// ============================================================================

function tabItemsFromRow(tab: TabRow): HostedArticleSectionItem[] {
  const items: HostedArticleSectionItem[] = []

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

  if (tab.tab_content && items.length === 0) {
    items.push({ type: "prose", html: tab.tab_content })
  }

  return items
}

// ============================================================================
// Reply tree
// ============================================================================

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

// ============================================================================
// Ollama narrative
// ============================================================================

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
    const { text } = await generateText({ prompt, maxTokens: 800, temperature: 0.6 })
    const match = /\{[\s\S]*\}/.exec(text)
    if (!match) return fallback
    const parsed = JSON.parse(match[0])
    return {
      deck: String(parsed.deck || fallback.deck),
      lead: String(parsed.lead || fallback.lead),
      sectionLeadIns: Array.isArray(parsed.sectionLeadIns) ? parsed.sectionLeadIns.map(String) : fallback.sectionLeadIns,
      sectionClosings: Array.isArray(parsed.sectionClosings) ? parsed.sectionClosings.map(String) : fallback.sectionClosings,
      discussionHeading: String(parsed.discussionHeading || fallback.discussionHeading),
    }
  } catch (err) {
    console.warn("[HostedPage] Ollama narrative generation failed, using fallback:", err)
    return fallback
  }
}

// ============================================================================
// Extra sections: Noted, chats, video
// ============================================================================

async function buildExtraSections(
  kind: StickKind,
  stick: StickRow,
  origin: string,
): Promise<HostedArticleSection[]> {
  const extras: HostedArticleSection[] = []

  // Noted pages — personal via personal_stick_id, pad/concur via stick_id
  const notedCol = kind === "personal" ? "personal_stick_id" : "stick_id"
  const notedResult = await db.query<{ title: string; content: string }>(
    `SELECT title, content FROM noted_pages WHERE ${notedCol} = $1 LIMIT 1`,
    [stick.id],
  )
  const noted = notedResult.rows[0]
  if (noted && (noted.content || noted.title)) {
    extras.push({
      tabName: noted.title?.trim() || "Noted",
      items: [{ type: "prose", html: noted.content || "" }],
    })
  }

  // Chat rooms linked to this stick
  if (kind === "personal" || kind === "pad") {
    const chatType = kind === "personal" ? "personal" : "social"
    const chatResult = await db.query<{ id: string; name: string | null; is_group: boolean }>(
      `SELECT id, name, is_group FROM stick_chats
       WHERE stick_id = $1 AND stick_type = $2
       ORDER BY created_at ASC`,
      [stick.id, chatType],
    )
    if (chatResult.rows.length > 0) {
      extras.push({
        tabName: "Chat Rooms",
        items: chatResult.rows.map((c) => ({
          type: "link" as const,
          title: c.name || (c.is_group ? "Group chat" : "Direct chat"),
          description: c.is_group ? "Group chat room" : "One-on-one chat",
          url: `${origin}/chat/${c.id}`,
        })),
      })
    }
  }

  // Video rooms for pad sticks (pad_id exists)
  if (kind === "pad" && stick.pad_id) {
    const videoResult = await db.query<{ id: string; name: string | null }>(
      `SELECT id, name FROM video_rooms
       WHERE pad_id = $1 AND livekit_room_name IS NOT NULL
       ORDER BY created_at ASC`,
      [stick.pad_id],
    )
    if (videoResult.rows.length > 0) {
      extras.push({
        tabName: "Video Rooms",
        items: videoResult.rows.map((v) => ({
          type: "link" as const,
          title: v.name || "Video room",
          description: "Join the LiveKit video session",
          url: `${origin}/video/join/${v.id}`,
        })),
      })
    }
  }

  return extras
}

// ============================================================================
// Main entry — generate or update a hosted page
// ============================================================================

export interface GenerateHostedPageResult {
  slug: string
  articleData: HostedArticleData
}

export async function generateHostedPage(
  kind: StickKind,
  stickId: string,
  userId: string,
  origin: string,
): Promise<GenerateHostedPageResult | { error: string; status: number }> {
  const cfg = KIND[kind]

  const extraCols = kind === "pad" ? ", pad_id" : kind === "concur" ? ", group_id" : ""
  const stickResult = await db.query<StickRow>(
    `SELECT id, user_id, topic, content, color, created_at, updated_at, org_id${extraCols}
     FROM ${cfg.stickTable} WHERE id = $1 LIMIT 1`,
    [stickId],
  )
  const stick = stickResult.rows[0]
  if (!stick) return { error: "Stick not found", status: 404 }

  const allowed = await canPublish(kind, stick, userId)
  if (!allowed) return { error: "Only owners or admins can publish", status: 403 }

  const tabsResult = await db.query<TabRow>(
    `SELECT id, tab_name, tab_type, tab_content, tab_data,
            ${kind === "personal" ? "tags" : "NULL::jsonb AS tags"},
            tab_order
     FROM ${cfg.tabsTable}
     WHERE ${cfg.tabsFk} = $1
     ORDER BY tab_order ASC, created_at ASC`,
    [stickId],
  )

  const parentCol = cfg.hasParentReplyId ? "r.parent_reply_id" : "NULL::uuid AS parent_reply_id"
  const repliesResult = await db.query<ReplyRow>(
    `SELECT r.id, r.content, r.created_at, r.user_id, ${parentCol}, u.full_name, u.email
     FROM ${cfg.repliesTable} r
     LEFT JOIN users u ON u.id = r.user_id
     WHERE r.${cfg.repliesFk} = $1
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

  const extras = await buildExtraSections(kind, stick, origin)
  sectionsSkeleton.push(...extras)

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
    footer: { stickId: stick.id, permalink: "", publishedAt: new Date().toISOString() },
  }

  const existing = await db.query<{ slug: string }>(
    `SELECT slug FROM stick_hosted_pages WHERE stick_id = $1 AND stick_kind = $2 LIMIT 1`,
    [stickId, kind],
  )
  const slug = existing.rows[0]?.slug || randomSlug(stick.topic || "")
  articleData.footer.permalink = `${origin}/hosted/${slug}`

  if (existing.rows[0]) {
    await db.query(
      `UPDATE stick_hosted_pages
       SET article_data = $1::jsonb, generated_by = $2, updated_at = NOW()
       WHERE stick_id = $3 AND stick_kind = $4`,
      [JSON.stringify(articleData), userId, stickId, kind],
    )
  } else {
    await db.query(
      `INSERT INTO stick_hosted_pages (stick_id, stick_kind, slug, generated_by, article_data)
       VALUES ($1, $2, $3, $4, $5::jsonb)`,
      [stickId, kind, slug, userId, JSON.stringify(articleData)],
    )
  }

  return { slug, articleData }
}

// Backwards-compatible shim for the personal endpoint
export async function generateHostedPageForPersonalStick(
  stickId: string,
  userId: string,
  origin: string,
) {
  return generateHostedPage("personal", stickId, userId, origin)
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

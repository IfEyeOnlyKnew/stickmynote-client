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
    // paks_pads and social_pads both own sticks in paks_pad_sticks
    const paksOwner = await db.query<{ owner_id: string }>(
      `SELECT owner_id FROM paks_pads WHERE id = $1 LIMIT 1`,
      [stick.pad_id],
    )
    if (paksOwner.rows[0]?.owner_id === userId) return true

    const socialOwner = await db.query<{ owner_id: string }>(
      `SELECT owner_id FROM social_pads WHERE id = $1 LIMIT 1`,
      [stick.pad_id],
    )
    if (socialOwner.rows[0]?.owner_id === userId) return true

    // stick-level admin on paks pads
    const stickAdmin = await db.query<{ role: string }>(
      `SELECT role FROM paks_pad_stick_members WHERE stick_id = $1 AND user_id = $2 LIMIT 1`,
      [stick.id, userId],
    )
    if (stickAdmin.rows[0]?.role === "admin") return true

    // pad-level admin on social pads
    const socialMember = await db.query<{ role: string; admin_level: string | null }>(
      `SELECT role, admin_level FROM social_pad_members
       WHERE social_pad_id = $1 AND user_id = $2 LIMIT 1`,
      [stick.pad_id, userId],
    )
    const sm = socialMember.rows[0]
    if (sm && (sm.role === "admin" || sm.admin_level)) return true

    return false
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

function extractLinkItems(tags: unknown): HostedArticleSectionItem[] {
  if (!Array.isArray(tags)) return []
  return tags
    .filter((link) => link?.url)
    .map((link) => ({
      type: "link" as const,
      title: link.title || link.url,
      description: link.summary || link.description,
      url: link.url,
    }))
}

function extractVideoItems(videos: unknown): HostedArticleSectionItem[] {
  if (!Array.isArray(videos)) return []
  return videos
    .filter((v) => v?.url || v?.embed_url)
    .map((v) => ({
      type: "video" as const,
      url: v.url,
      embedUrl: v.embed_url,
      platform: v.platform,
      title: v.title,
      caption: v.description || v.title,
    }))
}

function extractImageItems(images: unknown): HostedArticleSectionItem[] {
  if (!Array.isArray(images)) return []
  return images
    .filter((img) => img?.url)
    .map((img) => ({ type: "image" as const, url: img.url, alt: img.alt, caption: img.caption }))
}

const VIDEO_URL_RE = /(mp4|webm|youtube|youtu\.be|vimeo)/i
const IMAGE_URL_RE = /(jpg|jpeg|png|gif|webp|svg)/i

function classifyBareItem(d: { url: string; title?: string; description?: string; caption?: string }): HostedArticleSectionItem {
  if (VIDEO_URL_RE.test(d.url)) return { type: "video", url: d.url, caption: d.caption || d.title }
  if (IMAGE_URL_RE.test(d.url)) return { type: "image", url: d.url, caption: d.caption || d.title }
  return { type: "link", title: d.title, url: d.url, description: d.description }
}

function extractBareArrayItems(tabData: unknown): HostedArticleSectionItem[] {
  if (!Array.isArray(tabData)) return []
  return tabData.filter((d) => d?.url).map(classifyBareItem)
}

function tabItemsFromRow(tab: TabRow): HostedArticleSectionItem[] {
  const items: HostedArticleSectionItem[] = [
    ...extractLinkItems(tab.tags),
    ...extractVideoItems(tab.tab_data?.videos),
    ...extractImageItems(tab.tab_data?.images),
    ...extractBareArrayItems(tab.tab_data),
  ]

  // Details / rich-text tab with HTML body — only if nothing else was extracted
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

function extraPadColumnForKind(kind: StickKind): string {
  if (kind === "pad") return ", pad_id"
  if (kind === "concur") return ", group_id"
  return ""
}

async function loadStick(kind: StickKind, stickId: string): Promise<StickRow | null> {
  const cfg = KIND[kind]
  const result = await db.query<StickRow>(
    `SELECT id, user_id, topic, content, color, created_at, updated_at, org_id${extraPadColumnForKind(kind)}
     FROM ${cfg.stickTable} WHERE id = $1 LIMIT 1`,
    [stickId],
  )
  return result.rows[0] || null
}

async function loadTabs(kind: StickKind, stickId: string): Promise<TabRow[]> {
  const cfg = KIND[kind]
  const tagsCol = kind === "personal" ? "tags" : "NULL::jsonb AS tags"
  const result = await db.query<TabRow>(
    `SELECT id, tab_name, tab_type, tab_content, tab_data, ${tagsCol}, tab_order
     FROM ${cfg.tabsTable}
     WHERE ${cfg.tabsFk} = $1
     ORDER BY tab_order ASC, created_at ASC`,
    [stickId],
  )
  return result.rows
}

async function loadReplies(kind: StickKind, stickId: string): Promise<ReplyRow[]> {
  const cfg = KIND[kind]
  const parentCol = cfg.hasParentReplyId ? "r.parent_reply_id" : "NULL::uuid AS parent_reply_id"
  const result = await db.query<ReplyRow>(
    `SELECT r.id, r.content, r.created_at, r.user_id, ${parentCol}, u.full_name, u.email
     FROM ${cfg.repliesTable} r
     LEFT JOIN users u ON u.id = r.user_id
     WHERE r.${cfg.repliesFk} = $1
     ORDER BY r.created_at ASC`,
    [stickId],
  )
  return result.rows
}

async function loadAuthor(userId: string): Promise<{ full_name: string | null; email: string } | undefined> {
  const result = await db.query<{ full_name: string | null; email: string }>(
    `SELECT full_name, email FROM users WHERE id = $1 LIMIT 1`,
    [userId],
  )
  return result.rows[0]
}

type Narrative = Awaited<ReturnType<typeof askOllamaForNarrative>>

function buildArticleData(
  stick: StickRow,
  sections: HostedArticleSection[],
  replyTree: HostedArticleReply[],
  author: { full_name: string | null; email: string } | undefined,
  narrative: Narrative,
): HostedArticleData {
  const authorName = author?.full_name || author?.email || "Unknown author"
  const discussion = replyTree.length > 0
    ? { heading: narrative.discussionHeading, replies: replyTree }
    : undefined

  return {
    masthead: { wordmark: "Stick My Note", tagline: "Hosted from a Stick" },
    hero: {
      topic: stick.topic || "Untitled",
      deck: narrative.deck,
      authorName,
      createdAt: stick.created_at,
      updatedAt: stick.updated_at || undefined,
      accentColor: stick.color || "#6366f1",
    },
    lead: narrative.lead,
    body: stick.content || undefined,
    sections,
    discussion,
    footer: { stickId: stick.id, permalink: "", publishedAt: new Date().toISOString() },
  }
}

async function persistArticle(
  stickId: string,
  kind: StickKind,
  userId: string,
  articleData: HostedArticleData,
  origin: string,
  fallbackSlugSource: string,
): Promise<string> {
  const existing = await db.query<{ slug: string }>(
    `SELECT slug FROM stick_hosted_pages WHERE stick_id = $1 AND stick_kind = $2 LIMIT 1`,
    [stickId, kind],
  )
  const slug = existing.rows[0]?.slug || randomSlug(fallbackSlugSource)
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

  return slug
}

export async function generateHostedPage(
  kind: StickKind,
  stickId: string,
  userId: string,
  origin: string,
): Promise<GenerateHostedPageResult | { error: string; status: number }> {
  const stick = await loadStick(kind, stickId)
  if (!stick) return { error: "Stick not found", status: 404 }

  const allowed = await canPublish(kind, stick, userId)
  if (!allowed) return { error: "Only owners or admins can publish", status: 403 }

  const [tabs, replyRows, author, extras] = await Promise.all([
    loadTabs(kind, stickId),
    loadReplies(kind, stickId),
    loadAuthor(stick.user_id),
    buildExtraSections(kind, stick, origin),
  ])

  const sectionsSkeleton: HostedArticleSection[] = [
    ...tabs.map((tab) => ({
      tabName: tab.tab_name || "Untitled Section",
      items: tabItemsFromRow(tab),
    })),
    ...extras,
  ]

  const narrative = await askOllamaForNarrative(stick, sectionsSkeleton)
  const sections: HostedArticleSection[] = sectionsSkeleton.map((s, i) => ({
    ...s,
    leadIn: narrative.sectionLeadIns[i] || undefined,
    closing: narrative.sectionClosings[i] || undefined,
  }))

  const replyTree = buildReplyTree(replyRows)
  const articleData = buildArticleData(stick, sections, replyTree, author, narrative)

  const slug = await persistArticle(stickId, kind, userId, articleData, origin, stick.topic || "")
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

/**
 * Check if a user can publish a hosted page for this stick.
 * Looks up the stick in each kind's table and applies the kind-specific rule.
 */
export async function canUserPublishStick(
  stickId: string,
  userId: string,
): Promise<{ canPublish: boolean; kind: StickKind | null }> {
  for (const kind of ["personal", "pad", "concur"] as StickKind[]) {
    const cfg = KIND[kind]
    const extraCols = extraPadColumnForKind(kind)
    const result = await db.query<StickRow>(
      `SELECT id, user_id, topic, content, color, created_at, updated_at, org_id${extraCols}
       FROM ${cfg.stickTable} WHERE id = $1 LIMIT 1`,
      [stickId],
    )
    const stick = result.rows[0]
    if (!stick) continue
    const allowed = await canPublish(kind, stick, userId)
    return { canPublish: allowed, kind }
  }
  return { canPublish: false, kind: null }
}

export async function getHostedPageBySlug(slug: string): Promise<HostedArticleData | null> {
  const result = await db.query<{ article_data: HostedArticleData }>(
    `SELECT article_data FROM stick_hosted_pages WHERE slug = $1 LIMIT 1`,
    [slug],
  )
  return result.rows[0]?.article_data || null
}

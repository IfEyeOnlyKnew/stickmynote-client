import { type NextRequest, NextResponse } from "next/server"
import { createDatabaseClient, createServiceDatabaseClient } from "@/lib/database/database-adapter"
import { applyRateLimit } from "@/lib/rate-limiter-enhanced"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"
import { generateText, isAIAvailable } from "@/lib/ai/ai-provider"

// ============================================================================
// Dynamic Module Loading
// ============================================================================

import { put } from "@/lib/storage/local-storage"

let Document: any, Packer: any, Paragraph: any, TextRun: any, HeadingLevel: any

const initializeModules = async () => {
  try {
    const docxModule = await import("docx")
    Document = docxModule.Document
    Packer = docxModule.Packer
    Paragraph = docxModule.Paragraph
    TextRun = docxModule.TextRun
    HeadingLevel = docxModule.HeadingLevel
  } catch (error) {
    console.error("[summarize-replies] Docx module load error:", error)
    Document = class Document {}
    Packer = { toBuffer: async () => Buffer.from("") }
    Paragraph = class Paragraph {}
    TextRun = class TextRun {}
    HeadingLevel = { TITLE: 0, HEADING_1: 1, HEADING_2: 2 }
  }
}

// ============================================================================
// Types
// ============================================================================

interface Reply {
  id: string
  content: string
  created_at: string
  updated_at?: string
  user_id: string
  user?: UserInfo | string
}

interface UserInfo {
  id?: string
  username?: string
  email?: string
}

interface SummarizeRequest {
  noteId: string
  tone?: string
  replies?: any[]
  generateDocx?: boolean
}

// ============================================================================
// Constants
// ============================================================================

const LOG_PREFIX = "[SummarizeReplies]"
const DEFAULT_TONE = "formal"

const TONE_INSTRUCTIONS: Record<string, string> = {
  cinematic:
    "Write this summary as if it were a movie script scene description. Use dramatic language, visual imagery, and narrative flow. Focus on the emotional arc and character dynamics.",
  formal:
    "Provide a professional, structured summary suitable for a business report. Use clear, objective language and organize key points logically.",
  casual:
    "Write this summary in a conversational, friendly tone as if explaining to a friend. Use everyday language and focus on the main takeaways.",
  dramatic:
    "Write this summary as a compelling narrative with rich descriptions and emotional depth, like a chapter from a novel. Emphasize the human elements and story arc.",
}

// ============================================================================
// Error Responses
// ============================================================================

const Errors = {
  rateLimit: () => NextResponse.json(
    { error: "Too many requests. Please try again later." },
    { status: 429, headers: { "Retry-After": "30" } }
  ),
  summarizeRateLimit: (headers: Record<string, string>) => NextResponse.json(
    { error: "Too many summarization requests. Please try again later." },
    { status: 429, headers: { "Retry-After": "60", ...headers } }
  ),
  noteIdRequired: () => NextResponse.json({ error: "Note ID is required" }, { status: 400 }),
  aiNotConfigured: () => NextResponse.json({ error: "AI service not configured" }, { status: 500 }),
  fetchRepliesFailed: () => NextResponse.json({ error: "Failed to fetch replies" }, { status: 500 }),
  fetchUsersFailed: () => NextResponse.json({ error: "Failed to fetch user data" }, { status: 500 }),
  summaryFailed: () => NextResponse.json({ error: "Failed to generate summary" }, { status: 500 }),
}

// ============================================================================
// Helpers
// ============================================================================

function getTonePrompt(tone: string): string {
  return TONE_INSTRUCTIONS[tone] || TONE_INSTRUCTIONS.formal
}

function formatRepliesText(replies: Reply[], userMap: Map<string, UserInfo>): string {
  return replies
    .map((reply, index) => {
      const user = reply.user || userMap.get(reply.user_id)
      const author = getAuthorName(user)
      const timestamp = new Date(reply.created_at).toLocaleDateString()
      return `Reply ${index + 1} by ${author} (${timestamp}):\n${reply.content}`
    })
    .join("\n\n")
}

function getAuthorName(user: UserInfo | string | undefined): string {
  if (!user) return "Anonymous"
  if (typeof user === "string") return user
  return user.username || user.email || "Anonymous"
}

// ============================================================================
// Data Fetching
// ============================================================================

function transformProvidedReplies(providedReplies: any[]): Reply[] {
  return providedReplies.map((reply, index) => ({
    id: `reply-${index}`,
    content: reply.content,
    created_at: reply.created_at || new Date().toISOString(),
    user_id: reply.user_id || "user",
    user: reply.user || "User",
  }))
}

async function fetchPersonalReplies(db: any, noteId: string): Promise<{ replies: Reply[] | null; error: any }> {
  const { data, error } = await db
    .from("personal_sticks_replies")
    .select("id, content, created_at, updated_at, user_id")
    .eq("personal_stick_id", noteId)
    .order("created_at", { ascending: true })

  return { replies: data, error }
}

async function fetchUserMap(db: any, userIds: string[]): Promise<{ userMap: Map<string, UserInfo>; error: any }> {
  if (userIds.length === 0) {
    return { userMap: new Map<string, UserInfo>(), error: null }
  }

  const { data: users, error } = await db
    .from("users")
    .select("id, username, email")
    .in("id", userIds)

  const userMap = new Map<string, UserInfo>(
    (users as UserInfo[] | null)?.map((user) => [user.id!, user] as [string, UserInfo]) || []
  )
  return { userMap, error }
}

type FetchRepliesResult =
  | { success: true; replies: Reply[]; userIds: string[] }
  | { success: false; response: NextResponse }

async function fetchReplies(
  db: any,
  noteId: string,
  providedReplies: any[] | undefined
): Promise<FetchRepliesResult> {
  // Use provided replies if available
  if (providedReplies && Array.isArray(providedReplies)) {
    return {
      success: true,
      replies: transformProvidedReplies(providedReplies),
      userIds: [],
    }
  }

  // Fetch personal replies
  const { replies, error } = await fetchPersonalReplies(db, noteId)
  if (error) {
    return { success: false, response: Errors.fetchRepliesFailed() }
  }
  const fetchedReplies = replies || []
  const userIds = [...new Set(fetchedReplies.map((reply) => reply.user_id))] as string[]
  return { success: true, replies: fetchedReplies, userIds }
}

// ============================================================================
// AI Summary Generation
// ============================================================================

async function generateAISummary(repliesText: string, tone: string): Promise<{ summary: string | null; error: boolean; errorMessage?: string }> {
  try {
    const prompt = `${getTonePrompt(tone)}

Please summarize the following replies to a note:

${repliesText}

Summary:`

    console.log("[summarize-replies] Calling AI provider...")
    const { text } = await generateText({
      prompt,
      maxTokens: 500,
    })
    console.log("[summarize-replies] AI provider returned successfully")

    return { summary: text || "Unable to generate summary", error: false }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown AI error"
    console.error("[summarize-replies] AI generation error:", errorMessage)
    return { summary: null, error: true, errorMessage }
  }
}

// ============================================================================
// DOCX Generation
// ============================================================================

async function generateDocxDocument(
  summary: string,
  replies: Reply[],
  tone: string,
  noteId: string
): Promise<{ url: string; filename: string }> {
  const summaryParagraphs = summary
    .split(/\n\n+/)
    .filter((paragraph: string) => paragraph.trim().length > 0)
    .map((paragraph: string) => paragraph.trim())

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            text: "REPLY SUMMARY",
            heading: HeadingLevel.TITLE,
            spacing: { after: 400 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: `Generated on ${new Date().toLocaleDateString()} | Tone: ${tone.charAt(0).toUpperCase() + tone.slice(1)} | ${replies.length} Replies`,
                italics: true,
                size: 20,
              }),
            ],
            spacing: { after: 600 },
          }),
          new Paragraph({
            text: "SUMMARY",
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 },
          }),
          ...summaryParagraphs.map(
            (paragraphText: string) =>
              new Paragraph({
                children: [new TextRun({ text: paragraphText, size: 24 })],
                spacing: { after: 300 },
              })
          ),
          new Paragraph({
            text: "ORIGINAL REPLIES",
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 },
          }),
          ...replies.flatMap((reply) => [
            new Paragraph({
              children: [
                new TextRun({
                  text: getAuthorName(reply.user),
                  bold: true,
                  size: 26,
                }),
                new TextRun({
                  text: ` (${new Date(reply.created_at).toLocaleDateString()})`,
                  italics: true,
                  size: 22,
                }),
              ],
              spacing: { after: 100 },
            }),
            new Paragraph({
              children: [new TextRun({ text: reply.content, size: 24 })],
              spacing: { after: 400 },
            }),
          ]),
        ],
      },
    ],
  })

  const buffer = await Packer.toBuffer(doc)
  const toneLabel = tone.charAt(0).toUpperCase() + tone.slice(1)
  const filename = `Reply-Summary-${toneLabel}-${noteId.slice(0, 8)}-${Date.now()}.docx`
  const blob = await put(filename, Buffer.from(buffer), { folder: "documents" })

  return { url: blob.url, filename }
}

interface ExportLink {
  url: string
  filename: string
  created_at: string
  type: string
}

function parseTabDataSafe(tabData: unknown): { exports?: ExportLink[]; [key: string]: any } {
  try {
    if (typeof tabData === "string") return JSON.parse(tabData)
    if (tabData && typeof tabData === "object") return tabData as { exports?: ExportLink[] }
  } catch {
    // fall through
  }
  return {}
}

async function upsertDetailsTabExport(
  db: any,
  noteId: string,
  noteOwnerId: string,
  existingTab: { id: string; tab_data: unknown } | null,
  exportLink: ExportLink,
): Promise<void> {
  if (existingTab) {
    const currentData = parseTabDataSafe(existingTab.tab_data)
    const newTabData = { ...currentData, exports: [...(currentData.exports || []), exportLink] }
    const { error } = await db
      .from("personal_sticks_tabs")
      .update({ tab_data: newTabData, updated_at: new Date().toISOString() })
      .eq("id", existingTab.id)
    if (error) console.error("[summarize-replies] Error updating tab:", error)
    return
  }

  const { error } = await db.from("personal_sticks_tabs").insert({
    personal_stick_id: noteId,
    user_id: noteOwnerId,
    tab_type: "details",
    tab_name: "Details",
    tab_content: "Note details and exports",
    tab_data: { exports: [exportLink] },
    tab_order: 3,
  })
  if (error) console.error("[summarize-replies] Error inserting tab:", error)
}

async function saveExportLinkToDetailsTab(
  db: any,
  noteId: string,
  currentUserId: string,
  exportLink: ExportLink
): Promise<void> {
  try {
    const { data: note, error: noteError } = await db
      .from("personal_sticks")
      .select("user_id")
      .eq("id", noteId)
      .single()

    if (noteError || !note) {
      console.error("[summarize-replies] Error fetching note:", noteError || "not found")
      return
    }

    const { data: existingTab } = await db
      .from("personal_sticks_tabs")
      .select("id, tab_data")
      .eq("personal_stick_id", noteId)
      .eq("user_id", note.user_id)
      .eq("tab_type", "details")
      .maybeSingle()

    await upsertDetailsTabExport(db, noteId, note.user_id, existingTab, exportLink)
  } catch (error) {
    console.error("[summarize-replies] Failed to save export link:", error)
  }
}

async function tryCleanupDocx(blobUrl: string, filename: string): Promise<string | null> {
  try {
    const cleanupResponse = await fetch(
      `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/api/cleanup-docx`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blobUrl, filename }),
      }
    )

    if (cleanupResponse.ok) {
      const cleanupResult = await cleanupResponse.json()
      return cleanupResult.cleanedUrl
    }
  } catch (cleanupError) {
    console.error("[summarize-replies] Cleanup error:", cleanupError)
    // Fall back to original document if cleanup fails
  }
  return null
}

// ============================================================================
// Route Handler
// ============================================================================

export async function POST(request: NextRequest) {
  console.log("[summarize-replies] POST request received")

  try {
    await initializeModules()
    console.log("[summarize-replies] Modules initialized")

    const db = await createDatabaseClient()
    const serviceDb = await createServiceDatabaseClient()
    console.log("[summarize-replies] Database clients created")

    // Auth check
    const authResult = await getCachedAuthUser()
    console.log("[summarize-replies] Auth result:", authResult.user?.id ? "authenticated" : "not authenticated")
    if (authResult.rateLimited) {
      return Errors.rateLimit()
    }

    // Rate limit check
    const rateLimitResult = await applyRateLimit(request, authResult.user?.id, "ai_summarize")
    if (!rateLimitResult.success) {
      console.log("[summarize-replies] Rate limited")
      return Errors.summarizeRateLimit(rateLimitResult.headers || {})
    }

    // Parse and validate request
    const { noteId, tone = DEFAULT_TONE, replies: providedReplies, generateDocx = false }: SummarizeRequest = await request.json()
    console.log("[summarize-replies] Request parsed:", { noteId, tone, generateDocx, hasReplies: !!providedReplies })

    if (!noteId) {
      console.log("[summarize-replies] Error: noteId required")
      return Errors.noteIdRequired()
    }

    console.log("[summarize-replies] Checking AI availability...")
    if (!isAIAvailable()) {
      console.log("[summarize-replies] Error: AI not configured")
      return Errors.aiNotConfigured()
    }
    console.log("[summarize-replies] AI is available")

    // Fetch replies
    console.log("[summarize-replies] Fetching replies...")
    const repliesResult = await fetchReplies(db, noteId, providedReplies)
    if (!repliesResult.success) {
      console.log("[summarize-replies] Error: Failed to fetch replies")
      return repliesResult.response
    }

    const { replies, userIds } = repliesResult
    console.log("[summarize-replies] Found", replies.length, "replies")

    if (replies.length === 0) {
      console.log("[summarize-replies] No replies to summarize")
      return NextResponse.json({ summary: "No replies to summarize." })
    }

    // Fetch user data if needed
    console.log("[summarize-replies] Fetching user data...")
    const { userMap, error: usersError } = await fetchUserMap(serviceDb, userIds)
    if (usersError) {
      console.log("[summarize-replies] Error: Failed to fetch users")
      return Errors.fetchUsersFailed()
    }
    console.log("[summarize-replies] User data fetched")

    // Generate AI summary
    console.log("[summarize-replies] Generating AI summary with tone:", tone)
    const repliesText = formatRepliesText(replies, userMap)
    const { summary, error: aiError, errorMessage } = await generateAISummary(repliesText, tone)

    if (aiError || !summary) {
      console.error("[summarize-replies] AI generation failed:", errorMessage)
      return NextResponse.json(
        { error: `AI generation failed: ${errorMessage || "Unknown error"}` },
        { status: 500 }
      )
    }
    console.log("[summarize-replies] AI summary generated successfully")

    if (!generateDocx) {
      return NextResponse.json({ summary, replyCount: replies.length, tone })
    }

    // Generate DOCX
    console.log("[summarize-replies] Generating DOCX document...")
    const { url: docxUrl, filename } = await generateDocxDocument(summary, replies, tone, noteId)
    console.log("[summarize-replies] DOCX generated:", filename, "URL:", docxUrl)

    const cleanedUrl = await tryCleanupDocx(docxUrl, filename)
    const finalUrl = cleanedUrl || docxUrl

    // Save export link to the note's Details tab
    if (authResult.user?.id) {
      const exportLink: ExportLink = {
        url: finalUrl,
        filename,
        created_at: new Date().toISOString(),
        type: `reply-summary-${tone}`,
      }
      await saveExportLinkToDetailsTab(serviceDb, noteId, authResult.user.id, exportLink)
    }

    return NextResponse.json({
      summary, replyCount: replies.length, tone, docxUrl: finalUrl, filename,
    })
  } catch (error) {
    console.error(`${LOG_PREFIX} POST error:`, error)
    return Errors.summaryFailed()
  }
}

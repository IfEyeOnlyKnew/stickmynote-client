import { type NextRequest, NextResponse } from "next/server"
import { createServiceDatabaseClient, type DatabaseClient } from "@/lib/database/database-adapter"
import { validateCSRFMiddleware } from "@/lib/csrf"
import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from "@/lib/auth/cached-auth"
import { put } from "@/lib/storage/local-storage"
import { generateText as aiGenerateText, isAIAvailable } from "@/lib/ai/ai-provider"

/**
 * CHAT EXPORT API
 *
 * Exports a chat thread to DOCX format with AI-generated summary.
 * Saves export link to the note's Details tab.
 */

// ============================================================================
// Types
// ============================================================================

interface ExportLink {
  url: string
  filename: string
  created_at: string
  type: string
}

interface ExportData {
  exports?: ExportLink[]
  [key: string]: unknown
}

interface ChatMessage {
  id: string
  content: string
  created_at: string
  user_id: string
  user?: {
    username?: string
    email?: string
    full_name?: string
  }
}

interface ReplyContext {
  id: string
  content: string
  created_at: string
  user?: {
    username?: string
    email?: string
    full_name?: string
  }
}

// Dynamic module references (docx only, AI uses unified provider)
let Document: typeof import("docx").Document | undefined
let Packer: typeof import("docx").Packer | undefined
let Paragraph: typeof import("docx").Paragraph | undefined
let TextRun: typeof import("docx").TextRun | undefined
let HeadingLevel: typeof import("docx").HeadingLevel | undefined

const initializeModules = async () => {
  try {
    const docxModule = await import("docx")
    Document = docxModule.Document
    Packer = docxModule.Packer
    Paragraph = docxModule.Paragraph
    TextRun = docxModule.TextRun
    HeadingLevel = docxModule.HeadingLevel
  } catch (error) {
    console.warn("[ChatExport] docx module not available:", error instanceof Error ? error.message : String(error))
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function getDisplayName(user?: { full_name?: string; username?: string; email?: string }): string {
  if (!user) return "User"
  return user.full_name || user.username || user.email || "User"
}

function formatMessage(msg: ChatMessage): string {
  const userName = getDisplayName(msg.user)
  const date = new Date(msg.created_at).toLocaleString()
  return `${userName} (${date}):\n${msg.content}`
}

function formatReplyContext(reply: ReplyContext): string {
  const userName = getDisplayName(reply.user)
  const date = new Date(reply.created_at).toLocaleString()
  return `${userName} (${date}):\n${reply.content}`
}

async function fetchThreadContext(
  db: DatabaseClient,
  parentReplyId: string
): Promise<ReplyContext[]> {
  const context: ReplyContext[] = []
  let currentReplyId: string | null = parentReplyId

  // Traverse up the reply chain (limit to 10 to prevent infinite loops)
  let iterations = 0
  while (currentReplyId && iterations < 10) {
    iterations++

    const { data: reply } = await db
      .from("personal_sticks_replies")
      .select("id, content, created_at, user_id, parent_reply_id")
      .eq("id", currentReplyId)
      .maybeSingle()

    if (!reply) break

    // Fetch user info
    let userData = null
    if (reply.user_id) {
      const { data: user } = await db
        .from("users")
        .select("id, email, full_name, username")
        .eq("id", reply.user_id)
        .maybeSingle()
      userData = user
    }

    context.unshift({
      id: reply.id,
      content: reply.content,
      created_at: reply.created_at,
      user: userData ?? undefined,
    })

    currentReplyId = reply.parent_reply_id
  }

  return context
}

async function saveExportLink(
  db: DatabaseClient,
  noteId: string,
  userId: string,
  exportLink: ExportLink
): Promise<void> {
  const { data: existingDetailsTab } = await db
    .from("personal_sticks_tabs")
    .select("*")
    .eq("personal_stick_id", noteId)
    .eq("tab_type", "details")
    .single()

  if (existingDetailsTab) {
    let currentData: ExportData = {}
    try {
      if (typeof existingDetailsTab.tab_data === "string") {
        currentData = JSON.parse(existingDetailsTab.tab_data)
      } else if (existingDetailsTab.tab_data && typeof existingDetailsTab.tab_data === "object") {
        currentData = existingDetailsTab.tab_data as ExportData
      }
    } catch {
      currentData = {}
    }

    const updatedExports = [...(currentData.exports || []), exportLink]
    const newTabData = { ...currentData, exports: updatedExports }

    await db
      .from("personal_sticks_tabs")
      .update({
        tab_data: newTabData,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingDetailsTab.id)
  } else {
    await db.from("personal_sticks_tabs").insert({
      personal_stick_id: noteId,
      user_id: userId,
      tab_type: "details",
      tab_name: "Details",
      tab_content: "Note details and exports",
      tab_data: { exports: [exportLink] },
      tab_order: 3,
    })
  }
}

function buildChatExportPrompt(
  threadContext: ReplyContext[],
  messages: ChatMessage[]
): string {
  const threadContextSection = threadContext.length > 0
    ? threadContext.map(formatReplyContext).join("\n\n---\n\n")
    : "No prior thread context"

  const messagesSection = messages.length > 0
    ? messages.map(formatMessage).join("\n\n")
    : "No messages in chat"

  return `Please create a comprehensive summary of this chat conversation that occurred within a threaded discussion.

**Thread Context (Parent Replies Leading to Chat):**
${threadContextSection}

**Chat Messages:**
${messagesSection}

Please provide:
1. A brief overview of what the discussion was about
2. Key points and decisions made
3. Any action items or conclusions reached
4. Notable contributions from participants

Format the summary in clear paragraphs with good structure. Focus on the most important information and insights from the conversation.`
}

// ============================================================================
// Data Helpers
// ============================================================================

async function enrichMessagesWithUsers(
  db: DatabaseClient,
  messagesData: Array<{ id: string; content: string; created_at: string; user_id: string }>,
): Promise<ChatMessage[]> {
  const userIds = [...new Set(messagesData.map((m) => m.user_id).filter(Boolean))]
  const userMap = new Map<string, { username?: string; email?: string; full_name?: string }>()

  if (userIds.length > 0) {
    const { data: users } = await db
      .from("users")
      .select("id, email, full_name, username")
      .in("id", userIds)
    for (const u of users || []) {
      userMap.set(u.id, { username: u.username, email: u.email, full_name: u.full_name })
    }
  }

  return messagesData.map((m) => ({ ...m, user: userMap.get(m.user_id) ?? undefined }))
}

async function tryCleanupDocx(blobUrl: string, filename: string): Promise<string> {
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
    console.warn("[ChatExport] DOCX cleanup error, using original:", cleanupError)
  }
  return blobUrl
}

// ============================================================================
// Handler
// ============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ parentReplyId: string }> }
) {
  const isCSRFValid = await validateCSRFMiddleware(request)
  if (!isCSRFValid) {
    return NextResponse.json({ error: "Invalid or missing CSRF token" }, { status: 403 })
  }

  await initializeModules()

  try {
    const { parentReplyId } = await params
    const { noteId } = await request.json()

    if (!noteId) {
      return NextResponse.json({ error: "Note ID is required" }, { status: 400 })
    }

    if (!isAIAvailable()) {
      return NextResponse.json({ error: "AI service not available" }, { status: 500 })
    }

    if (!Document || !Paragraph || !TextRun || !HeadingLevel || !Packer) {
      return NextResponse.json({ error: "Document export modules not available" }, { status: 500 })
    }

    const DocClass = Document
    const ParagraphClass = Paragraph
    const TextRunClass = TextRun
    const HeadingLevelEnum = HeadingLevel
    const PackerClass = Packer

    // Auth check
    const { user, error: authError } = await getCachedAuthUser()

    if (authError === "rate_limited") {
      return createRateLimitResponse()
    }

    if (!user) {
      return createUnauthorizedResponse()
    }

    const db = await createServiceDatabaseClient()

    // Verify parent reply exists
    const { data: parentReply } = await db
      .from("personal_sticks_replies")
      .select("id, content, personal_stick_id")
      .eq("id", parentReplyId)
      .maybeSingle()

    if (!parentReply) {
      return NextResponse.json({ error: "Parent reply not found" }, { status: 404 })
    }

    // Fetch chat messages
    const { data: messagesData } = await db
      .from("chat_messages")
      .select("id, content, created_at, user_id")
      .eq("parent_reply_id", parentReplyId)
      .order("created_at", { ascending: true })

    if (!messagesData || messagesData.length === 0) {
      return NextResponse.json({ error: "No messages to export" }, { status: 400 })
    }

    const messages = await enrichMessagesWithUsers(db, messagesData)

    // Fetch thread context (parent replies leading to this chat)
    const threadContext = await fetchThreadContext(db, parentReplyId)

    // Generate AI summary
    const prompt = buildChatExportPrompt(threadContext, messages)

    let summary = "AI service unavailable"
    if (isAIAvailable()) {
      try {
        const result = await aiGenerateText({
          prompt,
          maxTokens: 1500,
        })
        summary = result.text
      } catch (e) {
        console.error("[ChatExport] AI generation failed:", e)
      }
    }

    // Build DOCX document
    const summaryParagraphs = summary
      .split(/\n\n+/)
      .filter((p: string) => p.trim().length > 0)
      .map((p: string) => p.trim())

    const threadContextParagraphs = threadContext.map((reply) => {
      const userName = getDisplayName(reply.user)
      const date = new Date(reply.created_at).toLocaleString()
      return new ParagraphClass({
        children: [
          new TextRunClass({ text: `${userName} `, bold: true, size: 22 }),
          new TextRunClass({ text: `(${date})`, italics: true, size: 20 }),
          new TextRunClass({ text: `\n${reply.content}`, size: 22 }),
        ],
        spacing: { after: 200 },
      })
    })

    const messageParagraphs = messages.map((msg) => {
      const userName = getDisplayName(msg.user)
      const date = new Date(msg.created_at).toLocaleString()
      return new ParagraphClass({
        children: [
          new TextRunClass({ text: `${userName} `, bold: true, size: 22 }),
          new TextRunClass({ text: `(${date})`, italics: true, size: 20 }),
          new TextRunClass({ text: `\n${msg.content}`, size: 22 }),
        ],
        spacing: { after: 200 },
      })
    })

    const doc = new DocClass({
      sections: [
        {
          children: [
            new ParagraphClass({
              text: "CHAT CONVERSATION EXPORT",
              heading: HeadingLevelEnum.TITLE,
              spacing: { after: 400 },
            }),
            new ParagraphClass({
              children: [
                new TextRunClass({
                  text: `Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`,
                  italics: true,
                  size: 20,
                }),
              ],
              spacing: { after: 200 },
            }),
            new ParagraphClass({
              children: [
                new TextRunClass({
                  text: `${messages.length} messages in conversation`,
                  italics: true,
                  size: 20,
                }),
              ],
              spacing: { after: 600 },
            }),

            // AI Summary Section
            new ParagraphClass({
              text: "AI-GENERATED SUMMARY",
              heading: HeadingLevelEnum.HEADING_1,
              spacing: { before: 400, after: 200 },
            }),
            ...summaryParagraphs.map(
              (paragraphText: string) =>
                new ParagraphClass({
                  children: [new TextRunClass({ text: paragraphText, size: 24 })],
                  spacing: { after: 300 },
                })
            ),

            // Thread Context Section
            new ParagraphClass({
              text: "THREAD CONTEXT",
              heading: HeadingLevelEnum.HEADING_1,
              spacing: { before: 400, after: 200 },
            }),
            new ParagraphClass({
              children: [
                new TextRunClass({
                  text: "The following replies led to this chat conversation:",
                  italics: true,
                  size: 20,
                }),
              ],
              spacing: { after: 200 },
            }),
            ...threadContextParagraphs,

            // Full Transcript Section
            new ParagraphClass({
              text: "FULL CONVERSATION TRANSCRIPT",
              heading: HeadingLevelEnum.HEADING_1,
              spacing: { before: 400, after: 200 },
            }),
            ...messageParagraphs,

            // Footer
            new ParagraphClass({
              children: [new TextRunClass({ text: "─".repeat(50), size: 20 })],
              spacing: { before: 600, after: 200 },
            }),
            new ParagraphClass({
              children: [
                new TextRunClass({
                  text: "Generated by Stick My Note - Chat Export",
                  italics: true,
                  size: 18,
                }),
              ],
            }),
          ],
        },
      ],
    })

    const buffer = await PackerClass.toBuffer(doc)
    const docxBlob = new Blob([new Uint8Array(buffer)], {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    })

    const filename = `chat-export-${parentReplyId.slice(0, 8)}-${Date.now()}.docx`
    const blob = await put(filename, Buffer.from(await docxBlob.arrayBuffer()), { folder: "documents" })

    const finalUrl = await tryCleanupDocx(blob.url, filename)

    // Save export link to Details tab
    await saveExportLink(db, noteId, user.id, {
      url: finalUrl,
      filename,
      created_at: new Date().toISOString(),
      type: "chat_export",
    })

    return NextResponse.json({
      success: true,
      exportUrl: finalUrl,
      filename,
      message: "Chat exported successfully with AI summary",
    })
  } catch (error) {
    console.error("[ChatExport] Error:", error)
    return NextResponse.json(
      { error: `Failed to export chat: ${(error as Error).message}` },
      { status: 500 }
    )
  }
}

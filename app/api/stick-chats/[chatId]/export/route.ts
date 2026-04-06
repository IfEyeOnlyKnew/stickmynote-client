import { type NextRequest, NextResponse } from "next/server"
import { validateCSRFMiddleware } from "@/lib/csrf"
import { getCachedAuthUser, createRateLimitResponse, createUnauthorizedResponse } from "@/lib/auth/cached-auth"
import { getOrgContext } from "@/lib/auth/get-org-context"
import { put } from "@/lib/storage/local-storage"
import { generateText as aiGenerateText, isAIAvailable } from "@/lib/ai/ai-provider"
import {
  getChatById,
  getAllChatMessages,
  isChatMember,
} from "@/lib/database/stick-chat-queries"
import { getChatDisplayName } from "@/types/stick-chat"

/**
 * STICK CHAT EXPORT API
 *
 * Exports a stick chat to DOCX format with AI-generated summary.
 */

// ============================================================================
// Types
// ============================================================================

interface OrgContext {
  orgId: string
  organizationId?: string
}

interface RateLimitedResult {
  rateLimited: true
}

// Dynamic module references
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
    console.warn("[StickChatExport] docx module not available:", error instanceof Error ? error.message : String(error))
  }
}

// ============================================================================
// Error Responses
// ============================================================================

const Errors = {
  csrf: () => NextResponse.json({ error: "Invalid or missing CSRF token" }, { status: 403 }),
  notMember: () => NextResponse.json({ error: "You are not a member of this chat" }, { status: 403 }),
  notFound: () => NextResponse.json({ error: "Chat not found" }, { status: 404 }),
  noMessages: () => NextResponse.json({ error: "No messages to export" }, { status: 400 }),
  aiNotAvailable: () => NextResponse.json({ error: "AI service not available" }, { status: 500 }),
  docxNotAvailable: () => NextResponse.json({ error: "Document export modules not available" }, { status: 500 }),
  exportFailed: () => NextResponse.json({ error: "Failed to export chat" }, { status: 500 }),
  internal: () => NextResponse.json({ error: "Internal server error" }, { status: 500 }),
} as const

// ============================================================================
// Auth Helpers
// ============================================================================

function isRateLimited(result: OrgContext | RateLimitedResult | null): result is RateLimitedResult {
  return result !== null && "rateLimited" in result
}

async function safeGetOrgContext(userId: string): Promise<OrgContext | RateLimitedResult | null> {
  try {
    return await getOrgContext(userId)
  } catch (error) {
    if (error instanceof Error && error.message === "RATE_LIMITED") {
      return { rateLimited: true }
    }
    throw error
  }
}

function handleRateLimitError(error: unknown): NextResponse | null {
  if (error instanceof Error && error.message === "RATE_LIMITED") {
    return createRateLimitResponse()
  }
  return null
}

// ============================================================================
// Helper Functions
// ============================================================================

function getDisplayName(user?: { full_name?: string; username?: string; email?: string }): string {
  if (!user) return "User"
  return user.full_name || user.username || user.email || "User"
}

function formatMessageForPrompt(msg: { content: string; created_at: string; user?: { full_name?: string; username?: string; email?: string } }): string {
  const userName = getDisplayName(msg.user)
  const date = new Date(msg.created_at).toLocaleString()
  return `${userName} (${date}):\n${msg.content}`
}

function buildExportPrompt(
  chatName: string,
  messages: Array<{ content: string; created_at: string; user?: { full_name?: string; username?: string; email?: string } }>
): string {
  const messagesSection = messages.map(formatMessageForPrompt).join("\n\n")

  return `Please create a comprehensive summary of this chat conversation titled "${chatName}".

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
// Handler
// ============================================================================

interface ExportContext {
  chatId: string
  user: { id: string }
  chat: any
  messages: any[]
  DocClass: typeof import("docx").Document
  ParagraphClass: typeof import("docx").Paragraph
  TextRunClass: typeof import("docx").TextRun
  PackerClass: typeof import("docx").Packer
}

async function validateExportRequest(
  request: NextRequest,
  chatId: string,
): Promise<{ ctx: ExportContext } | { error: NextResponse }> {
  const { user, error: authError } = await getCachedAuthUser()
  if (authError === "rate_limited") return { error: createRateLimitResponse() }
  if (!user) return { error: createUnauthorizedResponse() }

  const orgContextResult = await safeGetOrgContext(user.id)
  if (isRateLimited(orgContextResult)) return { error: createRateLimitResponse() }

  const isMember = await isChatMember(chatId, user.id)
  if (!isMember) return { error: Errors.notMember() }

  const chat = await getChatById(chatId, user.id)
  if (!chat) return { error: Errors.notFound() }

  const messages = await getAllChatMessages(chatId)
  if (messages.length === 0) return { error: Errors.noMessages() }

  if (!isAIAvailable()) return { error: Errors.aiNotAvailable() }
  if (!Document || !Paragraph || !TextRun || !HeadingLevel || !Packer) return { error: Errors.docxNotAvailable() }

  return {
    ctx: {
      chatId, user, chat, messages,
      DocClass: Document, ParagraphClass: Paragraph,
      TextRunClass: TextRun, PackerClass: Packer,
    },
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  const isCSRFValid = await validateCSRFMiddleware(request)
  if (!isCSRFValid) return Errors.csrf()

  await initializeModules()

  try {
    const { chatId } = await params
    const result = await validateExportRequest(request, chatId)
    if ("error" in result) return result.error

    const { ctx } = result
    const { user, chat, messages, DocClass, ParagraphClass, TextRunClass, PackerClass } = ctx
    const HeadingLevelEnum = HeadingLevel!

    // Get chat display name
    const chatName = getChatDisplayName(chat, user.id)

    // Generate AI summary
    const prompt = buildExportPrompt(chatName, messages)
    let summary = "Summary generation not available."

    try {
      const result = await aiGenerateText({ prompt, maxTokens: 1000 })
      if (result.text) {
        summary = result.text
      }
    } catch (aiError) {
      console.warn("[StickChatExport] AI summary failed:", aiError)
    }

    // Build DOCX document
    const docChildren: InstanceType<typeof ParagraphClass>[] = []

    // Title
    docChildren.push(
      new ParagraphClass({
        text: `Chat Export: ${chatName}`,
        heading: HeadingLevelEnum.HEADING_1,
      })
    )

    // Metadata
    const exportDate = new Date().toLocaleString()
    docChildren.push(
      new ParagraphClass({
        children: [
          new TextRunClass({ text: `Exported: ${exportDate}`, italics: true }),
        ],
      })
    )

    docChildren.push(
      new ParagraphClass({
        children: [
          new TextRunClass({ text: `Participants: ${chat.members?.length || 1}`, italics: true }),
        ],
      }),
      new ParagraphClass({
        children: [
          new TextRunClass({ text: `Messages: ${messages.length}`, italics: true }),
        ],
      }),
      new ParagraphClass({ text: "" }), // Spacer
      // AI Summary Section
      new ParagraphClass({
        text: "Executive Summary",
        heading: HeadingLevelEnum.HEADING_2,
      })
    )

    const summaryParagraphs = summary.split("\n\n").filter(Boolean)
    for (const para of summaryParagraphs) {
      docChildren.push(
        new ParagraphClass({
          children: [new TextRunClass({ text: para.trim() })],
        })
      )
    }

    docChildren.push(
      new ParagraphClass({ text: "" }), // Spacer
      // Full Conversation Section
      new ParagraphClass({
        text: "Full Conversation",
        heading: HeadingLevelEnum.HEADING_2,
      })
    )

    for (const msg of messages) {
      const userName = getDisplayName(msg.user)
      const msgDate = new Date(msg.created_at).toLocaleString()

      // Author and timestamp
      docChildren.push(
        new ParagraphClass({
          children: [
            new TextRunClass({ text: userName, bold: true }),
            new TextRunClass({ text: ` (${msgDate})`, italics: true }),
          ],
        })
      )

      // Message content
      docChildren.push(
        new ParagraphClass({
          children: [new TextRunClass({ text: msg.content })],
        }),
        new ParagraphClass({ text: "" }) // Spacer between messages
      )
    }

    // Footer
    docChildren.push(
      new ParagraphClass({
        text: "---",
      }),
      new ParagraphClass({
        children: [
          new TextRunClass({
            text: "Generated by StickyMyNote Chat Export",
            italics: true,
            color: "808080",
          }),
        ],
      })
    )

    // Create document
    const doc = new DocClass({
      sections: [
        {
          properties: {},
          children: docChildren,
        },
      ],
    })

    // Generate buffer
    const buffer = await PackerClass.toBuffer(doc)

    // Generate filename
    const timestamp = new Date().toISOString().replaceAll(/[:.]/g, "-").slice(0, 19)
    const safeFileName = chatName.replaceAll(/[^a-zA-Z0-9]/g, "_").slice(0, 50)
    const filename = `chat_export_${safeFileName}_${timestamp}.docx`

    // Upload to storage
    const blob = await put(filename, buffer, {
      access: "public",
      contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    })

    return NextResponse.json({
      exportUrl: blob.url,
      filename,
      messageCount: messages.length,
    })
  } catch (error) {
    const rateLimitResponse = handleRateLimitError(error)
    if (rateLimitResponse) return rateLimitResponse

    console.error("[StickChatExport] Export error:", error)
    return Errors.exportFailed()
  }
}

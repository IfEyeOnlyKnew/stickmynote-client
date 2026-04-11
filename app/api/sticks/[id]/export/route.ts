import { type NextRequest, NextResponse } from "next/server";
import { createDatabaseClient } from "@/lib/database/database-adapter";
import { getCachedAuthUser } from "@/lib/auth/cached-auth";
import { getOrgContext } from "@/lib/auth/get-org-context";
import type { DatabaseClient } from "@/lib/database/database-adapter";
import { generateText as aiProviderGenerateText, isAIAvailable } from "@/lib/ai/ai-provider";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import {
  type StickData,
  type Reply,
  type MediaLink,
  type ExportLink,
  getTonePrompt,
  formatVideoLinks,
  formatImageLinks,
  generateExportFilename,
  buildExportLink,
  initializeDocxModules,
  splitSummaryIntoParagraphs,
} from "@/lib/handlers/stick-export-handler";

async function checkUserAccess(
  db: DatabaseClient,
  stickData: StickData,
  userId: string
): Promise<boolean> {
  // Check if user is the stick owner
  if ((stickData as any).user_id === userId) {
    return true;
  }

  // Check if user is the pad owner
  if (stickData.pads?.owner_id === userId) {
    return true;
  }

  // Check if user is the multi-pak owner
  if (
    stickData.pads?.multi_pak_id &&
    stickData.pads?.multi_paks?.owner_id === userId
  ) {
    return true;
  }

  // Check direct stick membership
  const { data: stickMember } = await db
    .from("paks_pad_stick_members")
    .select("role")
    .eq("stick_id", stickData.id)
    .eq("user_id", userId)
    .maybeSingle();

  if (stickMember) {
    return true;
  }

  // Check direct pad membership
  const { data: padMember } = await db
    .from("paks_pad_members")
    .select("role")
    .eq("pad_id", stickData.pad_id)
    .eq("user_id", userId)
    .eq("accepted", true)
    .maybeSingle();

  if (padMember) {
    return true;
  }

  // Check multi-pak membership
  if (stickData.pads?.multi_pak_id) {
    const { data: multiPakMember } = await db
      .from("multi_pak_members")
      .select("role")
      .eq("multi_pak_id", stickData.pads.multi_pak_id)
      .eq("user_id", userId)
      .eq("accepted", true)
      .maybeSingle();

    if (multiPakMember) {
      return true;
    }
  }

  return false;
}

function buildPrompt(
  tone: string,
  stickData: StickData,
  videoLinks: MediaLink[],
  imageLinks: MediaLink[],
  replies: Reply[] | null
): string {
  const videoLinksFormatted =
    videoLinks.length > 0
      ? `- Video Links (${videoLinks.length}): ${videoLinks
          .map((v) =>
            [v.title || "Untitled", " (", v.embed_url || v.url, ")"].join("")
          )
          .join(", ")}`
      : "- No video content";
  const imageLinksFormatted =
    imageLinks.length > 0
      ? `- Image Links (${imageLinks.length}): ${imageLinks
          .map((i) => [i.caption || "Untitled", " (", i.url, ")"].join(""))
          .join(", ")}`
      : "- No image content";
  const repliesFormatted =
    replies && replies.length > 0
      ? replies
          .map((r) => {
            const username = r.user?.username || r.user?.email || "User";
            const date = new Date(r.created_at).toLocaleDateString();
            return `- ${username} (${date}): ${r.content}`;
          })
          .join("\n")
      : "- No replies yet";

  return `${getTonePrompt(tone)}

Please create a comprehensive summary of this Multi-pak Stick with all its components. Structure your response with clear paragraph breaks between different topics:

**Stick Information:**
- Topic: ${stickData.topic || "Untitled"}
- Content: ${stickData.content || "No content"}
- Pad: ${stickData.pads?.name || "Unknown Pad"}
- Created: ${new Date(stickData.created_at).toLocaleDateString()}
- Updated: ${
    stickData.updated_at
      ? new Date(stickData.updated_at).toLocaleDateString()
      : "Never"
  }

**Media Content:**
${videoLinksFormatted}
${imageLinksFormatted}

**Replies and Discussion (${replies?.length || 0} replies):**
${repliesFormatted}

Please provide a well-structured, comprehensive summary that captures all aspects of this stick. Use clear paragraph breaks to separate different topics and themes. Format it as a professional document that could serve as a complete record of this stick's content and discussion.`;
}

async function saveExportLink(
  db: DatabaseClient,
  stickId: string,
  userId: string,
  orgId: string,
  exportLink: ExportLink
): Promise<void> {
  const { data: existingDetailsTab } = await db
    .from("paks_pad_stick_tabs")
    .select("*")
    .eq("stick_id", stickId)
    .eq("tab_type", "details")
    .eq("org_id", orgId)
    .maybeSingle();

  if (existingDetailsTab) {
    let currentData: { exports?: ExportLink[]; [key: string]: any } = {};
    try {
      if (typeof existingDetailsTab.tab_data === "string") {
        currentData = JSON.parse(existingDetailsTab.tab_data);
      } else if (
        existingDetailsTab.tab_data &&
        typeof existingDetailsTab.tab_data === "object"
      ) {
        currentData = existingDetailsTab.tab_data as typeof currentData;
      }
    } catch {
      currentData = {};
    }

    const updatedExports = [...(currentData.exports || []), exportLink];
    const newTabData = { ...currentData, exports: updatedExports };

    await db
      .from("paks_pad_stick_tabs")
      .update({
        tab_data: newTabData,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingDetailsTab.id)
      .eq("org_id", orgId);
  } else {
    await db.from("paks_pad_stick_tabs").insert({
      stick_id: stickId,
      user_id: userId,
      org_id: orgId,
      tab_type: "details",
      tab_name: "Details",
      tab_content: "Stick details and exports",
      tab_data: { exports: [exportLink] },
      tab_order: 3,
    });
  }
}

// Fetch a stick's replies and enrich each reply with its author's username/email.
// Returns [] if the stick has no replies or the reply table query fails.
async function fetchRepliesWithUsers(
  db: DatabaseClient,
  stickId: string
): Promise<Reply[]> {
  const { data: replies } = await db
    .from("paks_pad_stick_replies")
    .select("*")
    .eq("stick_id", stickId)
    .order("created_at", { ascending: true });

  if (!replies || replies.length === 0) return [];

  const replyUserIds = [
    ...new Set(replies.map((r: any) => r.user_id).filter(Boolean)),
  ] as string[];

  let replyUserMap: Record<string, { username?: string; email?: string }> = {};
  if (replyUserIds.length > 0) {
    const { data: users } = await db
      .from("users")
      .select("id, username, email")
      .in("id", replyUserIds);
    if (users) {
      replyUserMap = Object.fromEntries(
        users.map((u: any) => [u.id, { username: u.username, email: u.email }])
      );
    }
  }

  return replies.map((reply: any) => ({
    ...reply,
    user: replyUserMap[reply.user_id] || null,
  })) as Reply[];
}

// Fetch stick tabs and split them into video/image lists suitable for both
// the prompt builder and the DOCX media section.
async function fetchMediaLinks(
  db: DatabaseClient,
  stickId: string
): Promise<{ videoLinks: MediaLink[]; imageLinks: MediaLink[] }> {
  const { data: stickTabs } = await db
    .from("paks_pad_stick_tabs")
    .select("*")
    .eq("stick_id", stickId)
    .order("tab_order", { ascending: true });

  const videoTabs = stickTabs?.filter((tab) => tab.tab_type === "video") || [];
  const imageTabs = stickTabs?.filter((tab) => tab.tab_type === "images") || [];

  return {
    videoLinks: formatVideoLinks(videoTabs),
    imageLinks: formatImageLinks(imageTabs),
  };
}

// Write a DOCX buffer to public/exports and return its public URL.
// Accepts either a Node Buffer (what docx.Packer.toBuffer returns) or an
// ArrayBuffer — both get written through Buffer.from().
async function saveExportToDisk(
  buffer: Buffer | ArrayBuffer,
  filename: string
): Promise<string> {
  const exportsDir = path.join(process.cwd(), "public", "exports");
  await mkdir(exportsDir, { recursive: true });
  const filePath = path.join(exportsDir, filename);
  await writeFile(filePath, Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer));
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return `${baseUrl}/exports/${filename}`;
}

type PadInfo = { name?: string; multi_pak_id?: string; owner_id?: string; multi_paks?: { owner_id?: string } }

async function fetchPadData(db: any, padId: string | null): Promise<PadInfo | null> {
  if (!padId) return null
  const { data: pad } = await db
    .from("paks_pads")
    .select("name, multi_pak_id, owner_id")
    .eq("id", padId)
    .maybeSingle();
  if (!pad) return null

  const padsData: PadInfo = { ...pad }
  if (pad.multi_pak_id) {
    const { data: multiPak } = await db
      .from("multi_paks")
      .select("owner_id")
      .eq("id", pad.multi_pak_id)
      .maybeSingle();
    if (multiPak) {
      padsData.multi_paks = { owner_id: multiPak.owner_id };
    }
  }
  return padsData
}

// Build the sections[0].children array for a DOCX export. Split into
// named sub-section builders so this file's POST handler doesn't carry
// 200 lines of inline `new DocxParagraph({...})` calls.

interface DocxModules {
  Document: any
  Paragraph: any
  TextRun: any
  HeadingLevel: any
}

function buildDocumentHeaderSection(
  docx: DocxModules,
  tone: string,
  summary: string
): any[] {
  const { Paragraph, TextRun, HeadingLevel } = docx
  const summaryParagraphs = splitSummaryIntoParagraphs(summary)

  return [
    new Paragraph({
      text: "MULTI-PAK STICK EXPORT",
      heading: HeadingLevel?.TITLE,
      spacing: { after: 400 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()} | Tone: ${
            tone.charAt(0).toUpperCase() + tone.slice(1)
          }`,
          italics: true,
          size: 20,
        }),
      ],
      spacing: { after: 600 },
    }),
    new Paragraph({
      text: "EXECUTIVE SUMMARY",
      heading: HeadingLevel?.HEADING_1,
      spacing: { before: 400, after: 200 },
    }),
    ...summaryParagraphs.map(
      (paragraphText: string) =>
        new Paragraph({
          children: [new TextRun({ text: paragraphText, size: 24 })],
          spacing: { after: 300 },
        })
    ),
  ]
}

function buildStickInfoSection(docx: DocxModules, stickData: StickData): any[] {
  const { Paragraph, TextRun, HeadingLevel } = docx
  return [
    new Paragraph({
      text: "STICK INFORMATION",
      heading: HeadingLevel?.HEADING_1,
      spacing: { before: 400, after: 200 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: "Topic: ", bold: true, size: 24 }),
        new TextRun({ text: stickData.topic || "Untitled", size: 24 }),
      ],
      spacing: { after: 200 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: "Pad: ", bold: true, size: 24 }),
        new TextRun({ text: stickData.pads?.name || "Unknown Pad", size: 24 }),
      ],
      spacing: { after: 200 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: "Created: ", bold: true, size: 24 }),
        new TextRun({
          text: new Date(stickData.created_at).toLocaleDateString(),
          size: 24,
        }),
      ],
      spacing: { after: 200 },
    }),
    new Paragraph({
      text: "MAIN CONTENT",
      heading: HeadingLevel?.HEADING_1,
      spacing: { before: 400, after: 200 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: stickData.content || "No content provided.",
          size: 24,
        }),
      ],
      spacing: { after: 400 },
    }),
  ]
}

function buildMediaSection(
  docx: DocxModules,
  videoLinks: MediaLink[],
  imageLinks: MediaLink[]
): any[] {
  if (videoLinks.length === 0 && imageLinks.length === 0) return []
  const { Paragraph, TextRun, HeadingLevel } = docx

  const videoBlock =
    videoLinks.length > 0
      ? [
          new Paragraph({
            children: [new TextRun({ text: "Videos:", bold: true, size: 24 })],
            spacing: { after: 200 },
          }),
          ...videoLinks.map(
            (video: MediaLink) =>
              new Paragraph({
                children: [
                  new TextRun({
                    text: `• ${video.title || "Untitled"}: ${video.embed_url || video.url}`,
                    size: 24,
                  }),
                ],
                spacing: { after: 200 },
              })
          ),
        ]
      : []

  const imageBlock =
    imageLinks.length > 0
      ? [
          new Paragraph({
            children: [new TextRun({ text: "Images:", bold: true, size: 24 })],
            spacing: { after: 200 },
          }),
          ...imageLinks.map(
            (image: MediaLink) =>
              new Paragraph({
                children: [
                  new TextRun({
                    text: `• ${image.caption || "Untitled"}: ${image.url}`,
                    size: 24,
                  }),
                ],
                spacing: { after: 200 },
              })
          ),
        ]
      : []

  return [
    new Paragraph({
      text: "MEDIA CONTENT",
      heading: HeadingLevel?.HEADING_1,
      spacing: { before: 400, after: 200 },
    }),
    ...videoBlock,
    ...imageBlock,
  ]
}

function buildRepliesSection(docx: DocxModules, replies: Reply[]): any[] {
  const { Paragraph, TextRun, HeadingLevel } = docx

  const header = new Paragraph({
    text: `DISCUSSION AND REPLIES (${replies.length})`,
    heading: HeadingLevel?.HEADING_1,
    spacing: { before: 400, after: 200 },
  })

  if (replies.length === 0) {
    return [
      header,
      new Paragraph({
        children: [
          new TextRun({
            text: "No replies or discussion available.",
            italics: true,
            size: 24,
          }),
        ],
        spacing: { after: 300 },
      }),
    ]
  }

  const replyParagraphs = replies.flatMap((reply: Reply) => [
    new Paragraph({
      children: [
        new TextRun({
          text: `${reply.user?.username || reply.user?.email || "Anonymous User"}`,
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
  ])

  return [header, ...replyParagraphs]
}

function buildFooterSection(docx: DocxModules): any[] {
  const { Paragraph, TextRun, HeadingLevel } = docx
  return [
    new Paragraph({
      text: "END OF DOCUMENT",
      heading: HeadingLevel?.HEADING_2,
      spacing: { before: 600, after: 200 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text:
            "This document contains a comprehensive export of the Multi-pak Stick including all content, media, and discussion threads. Generated automatically by Stick My Note application.",
          italics: true,
          size: 20,
        }),
      ],
      spacing: { after: 200 },
    }),
  ]
}

interface BuildExportDocArgs {
  docx: DocxModules
  tone: string
  summary: string
  stickData: StickData
  videoLinks: MediaLink[]
  imageLinks: MediaLink[]
  replies: Reply[]
}

function buildExportDocument(args: BuildExportDocArgs): any {
  const { docx, tone, summary, stickData, videoLinks, imageLinks, replies } = args
  const { Document } = docx
  return new Document({
    sections: [
      {
        children: [
          ...buildDocumentHeaderSection(docx, tone, summary),
          ...buildStickInfoSection(docx, stickData),
          ...buildMediaSection(docx, videoLinks, imageLinks),
          ...buildRepliesSection(docx, replies),
          ...buildFooterSection(docx),
        ],
      },
    ],
  })
}

// POST guard helpers — split out so the main handler reads as a linear
// pipeline instead of an 80-line wall of validation branches.

type AuthSuccess = { user: { id: string; email?: string }; orgContext: { orgId: string } }
type AuthFailure = { response: NextResponse }

async function authenticate(): Promise<AuthSuccess | AuthFailure> {
  const authResult = await getCachedAuthUser()
  if (authResult.rateLimited) {
    return {
      response: NextResponse.json(
        { error: "Rate limit exceeded. Please try again in a moment." },
        { status: 429, headers: { "Retry-After": "30" } }
      ),
    }
  }
  if (!authResult.user) {
    return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }
  const orgContext = await getOrgContext()
  if (!orgContext) {
    return {
      response: NextResponse.json(
        { error: "Organization context required" },
        { status: 403 }
      ),
    }
  }
  return { user: authResult.user, orgContext }
}

async function loadStickWithAccess(
  db: DatabaseClient,
  stickId: string,
  userId: string
): Promise<{ stick: StickData } | { response: NextResponse }> {
  const { data: stickData, error: stickError } = await db
    .from("paks_pad_sticks")
    .select("*")
    .eq("id", stickId)
    .maybeSingle()

  if (stickError || !stickData) {
    return {
      response: NextResponse.json(
        { error: "Stick not found or access denied" },
        { status: 404 }
      ),
    }
  }

  const padsData = await fetchPadData(db, stickData.pad_id)
  const stickDataWithPads = { ...stickData, pads: padsData } as StickData

  const hasAccess = await checkUserAccess(db, stickDataWithPads, userId)
  if (!hasAccess) {
    return {
      response: NextResponse.json({ error: "Access denied" }, { status: 403 }),
    }
  }

  return { stick: stickDataWithPads }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: stickId } = await params
    const { tone = "formal" } = await request.json()

    if (!isAIAvailable()) {
      return NextResponse.json({ error: "AI service not configured" }, { status: 500 })
    }

    const docx = await initializeDocxModules()
    if (!docx) {
      return NextResponse.json({ error: "DOCX generation not available" }, { status: 500 })
    }

    const auth = await authenticate()
    if ("response" in auth) return auth.response
    const { user, orgContext } = auth

    const db = await createDatabaseClient()

    const stickAccess = await loadStickWithAccess(db, stickId, user.id)
    if ("response" in stickAccess) return stickAccess.response
    const stickDataWithPads = stickAccess.stick

    // Use the stick's org_id for saving export link, not user's current context
    const stickOrgId = (stickDataWithPads as any).org_id || orgContext.orgId

    // Gather everything the DOCX and prompt builders need
    const [repliesWithUsers, { videoLinks, imageLinks }] = await Promise.all([
      fetchRepliesWithUsers(db, stickId),
      fetchMediaLinks(db, stickId),
    ])

    // Generate AI summary
    const prompt = buildPrompt(tone, stickDataWithPads, videoLinks, imageLinks, repliesWithUsers)
    const { text: comprehensiveSummary } = await aiProviderGenerateText({
      prompt,
      maxTokens: 2000,
    })

    // Build and save the DOCX
    const doc = buildExportDocument({
      docx,
      tone,
      summary: comprehensiveSummary,
      stickData: stickDataWithPads,
      videoLinks,
      imageLinks,
      replies: repliesWithUsers,
    })
    const buffer = await docx.Packer.toBuffer(doc)
    const filename = generateExportFilename(stickDataWithPads.topic)
    const fileUrl = await saveExportToDisk(buffer, filename)

    // Record the export in the stick's Details tab
    const exportLink = buildExportLink(fileUrl, filename)
    await saveExportLink(db, stickId, user.id, stickOrgId, exportLink)

    return NextResponse.json({
      success: true,
      exportUrl: fileUrl,
      filename,
      message: "Complete stick export generated successfully",
    })
  } catch (error) {
    console.error("Export stick error:", error)
    return NextResponse.json(
      { error: `Failed to export stick: ${(error as Error).message}` },
      { status: 500 }
    )
  }
}

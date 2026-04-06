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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const docx = await initializeDocxModules();

  try {
    const { id: stickId } = await params;
    const { tone = "formal" } = await request.json();

    // Check if AI service is configured
    if (!isAIAvailable()) {
      return NextResponse.json(
        { error: "AI service not configured" },
        { status: 500 }
      );
    }

    const db = await createDatabaseClient();

    const authResult = await getCachedAuthUser();
    if (authResult.rateLimited) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again in a moment." },
        { status: 429, headers: { "Retry-After": "30" } }
      );
    }
    if (!authResult.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = authResult.user;

    // Get org context
    const orgContext = await getOrgContext();
    if (!orgContext) {
      return NextResponse.json(
        { error: "Organization context required" },
        { status: 403 }
      );
    }

    // Fetch stick data
    const { data: stickData, error: stickError } = await db
      .from("paks_pad_sticks")
      .select("*")
      .eq("id", stickId)
      .maybeSingle();

    if (stickError || !stickData) {
      return NextResponse.json(
        { error: "Stick not found or access denied" },
        { status: 404 }
      );
    }

    // Fetch pad and multi-pak info separately
    let padsData: { name?: string; multi_pak_id?: string; owner_id?: string; multi_paks?: { owner_id?: string } } | null = null;
    if (stickData.pad_id) {
      const { data: pad } = await db
        .from("paks_pads")
        .select("name, multi_pak_id, owner_id")
        .eq("id", stickData.pad_id)
        .maybeSingle();

      if (pad) {
        padsData = { ...pad };
        if (pad.multi_pak_id && padsData) {
          const { data: multiPak } = await db
            .from("multi_paks")
            .select("owner_id")
            .eq("id", pad.multi_pak_id)
            .maybeSingle();
          if (multiPak) {
            padsData.multi_paks = { owner_id: multiPak.owner_id };
          }
        }
      }
    }
    const stickDataWithPads = { ...stickData, pads: padsData };

    const hasAccess = await checkUserAccess(
      db,
      stickDataWithPads as StickData,
      user.id
    );

    if (!hasAccess) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Use the stick's org_id for saving export link, not user's current context
    const stickOrgId = stickData.org_id || orgContext.orgId;

    // Fetch stick replies
    const { data: replies } = await db
      .from("paks_pad_stick_replies")
      .select("*")
      .eq("stick_id", stickId)
      .order("created_at", { ascending: true });

    // Fetch user data for replies
    const replyUserIds = [...new Set((replies || []).map((r: any) => r.user_id).filter(Boolean))] as string[];
    let replyUserMap: Record<string, { username?: string; email?: string }> = {};
    if (replyUserIds.length > 0) {
      const { data: users } = await db
        .from("users")
        .select("id, username, email")
        .in("id", replyUserIds);
      if (users) {
        replyUserMap = Object.fromEntries(users.map((u: any) => [u.id, { username: u.username, email: u.email }]));
      }
    }
    const repliesWithUsers = (replies || []).map((reply: any) => ({
      ...reply,
      user: replyUserMap[reply.user_id] || null,
    }));

    // Fetch stick tabs
    const { data: stickTabs } = await db
      .from("paks_pad_stick_tabs")
      .select("*")
      .eq("stick_id", stickId)
      .order("tab_order", { ascending: true });

    // Process tabs content
    const videoTabs =
      stickTabs?.filter((tab) => tab.tab_type === "video") || [];
    const imageTabs =
      stickTabs?.filter((tab) => tab.tab_type === "images") || [];
    const videoLinks = formatVideoLinks(videoTabs);
    const imageLinks = formatImageLinks(imageTabs);

    // Build prompt and generate AI summary
    const prompt = buildPrompt(
      tone,
      stickDataWithPads as StickData,
      videoLinks,
      imageLinks,
      repliesWithUsers as Reply[] | null
    );

    // Generate comprehensive summary using AI
    const { text: comprehensiveSummary } = await aiProviderGenerateText({
      prompt: prompt,
      maxTokens: 2000,
    });

    // Check if docx module is available
    if (!docx) {
      return NextResponse.json(
        { error: "DOCX generation not available" },
        { status: 500 }
      );
    }

    const { Document: DocxDocument, Paragraph: DocxParagraph, TextRun: DocxTextRun, Packer: DocxPacker, HeadingLevel } = docx;

    // Create DOCX document
    const summaryParagraphs = splitSummaryIntoParagraphs(comprehensiveSummary);

    const doc = new DocxDocument({
      sections: [
        {
          children: [
            // Title
            new DocxParagraph({
              text: "MULTI-PAK STICK EXPORT",
              heading: HeadingLevel?.TITLE,
              spacing: { after: 400 },
            }),

            // Document metadata
            new DocxParagraph({
              children: [
                new DocxTextRun({
                  text: `Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()} | Tone: ${
                    tone.charAt(0).toUpperCase() + tone.slice(1)
                  }`,
                  italics: true,
                  size: 20,
                }),
              ],
              spacing: { after: 600 },
            }),

            // Executive Summary
            new DocxParagraph({
              text: "EXECUTIVE SUMMARY",
              heading: HeadingLevel?.HEADING_1,
              spacing: { before: 400, after: 200 },
            }),
            ...summaryParagraphs.map(
              (paragraphText: string) =>
                new DocxParagraph({
                  children: [
                    new DocxTextRun({
                      text: paragraphText,
                      size: 24,
                    }),
                  ],
                  spacing: { after: 300 },
                })
            ),

            // Stick Information
            new DocxParagraph({
              text: "STICK INFORMATION",
              heading: HeadingLevel?.HEADING_1,
              spacing: { before: 400, after: 200 },
            }),
            new DocxParagraph({
              children: [
                new DocxTextRun({ text: "Topic: ", bold: true, size: 24 }),
                new DocxTextRun({
                  text: stickDataWithPads.topic || "Untitled",
                  size: 24,
                }),
              ],
              spacing: { after: 200 },
            }),
            new DocxParagraph({
              children: [
                new DocxTextRun({ text: "Pad: ", bold: true, size: 24 }),
                new DocxTextRun({
                  text: stickDataWithPads.pads?.name || "Unknown Pad",
                  size: 24,
                }),
              ],
              spacing: { after: 200 },
            }),
            new DocxParagraph({
              children: [
                new DocxTextRun({ text: "Created: ", bold: true, size: 24 }),
                new DocxTextRun({
                  text: new Date(stickDataWithPads.created_at).toLocaleDateString(),
                  size: 24,
                }),
              ],
              spacing: { after: 200 },
            }),

            // Main Content
            new DocxParagraph({
              text: "MAIN CONTENT",
              heading: HeadingLevel?.HEADING_1,
              spacing: { before: 400, after: 200 },
            }),
            new DocxParagraph({
              children: [
                new DocxTextRun({
                  text: stickDataWithPads.content || "No content provided.",
                  size: 24,
                }),
              ],
              spacing: { after: 400 },
            }),

            // Media Content
            ...(videoLinks.length > 0 || imageLinks.length > 0
              ? [
                  new DocxParagraph({
                    text: "MEDIA CONTENT",
                    heading: HeadingLevel?.HEADING_1,
                    spacing: { before: 400, after: 200 },
                  }),
                  ...(videoLinks.length > 0
                    ? [
                        new DocxParagraph({
                          children: [
                            new DocxTextRun({
                              text: "Videos:",
                              bold: true,
                              size: 24,
                            }),
                          ],
                          spacing: { after: 200 },
                        }),
                        ...videoLinks.map(
                          (video: any) =>
                            new DocxParagraph({
                              children: [
                                new DocxTextRun({
                                  text: `• ${video.title || "Untitled"}: ${
                                    video.embed_url || video.url
                                  }`,
                                  size: 24,
                                }),
                              ],
                              spacing: { after: 200 },
                            })
                        ),
                      ]
                    : []),
                  ...(imageLinks.length > 0
                    ? [
                        new DocxParagraph({
                          children: [
                            new DocxTextRun({
                              text: "Images:",
                              bold: true,
                              size: 24,
                            }),
                          ],
                          spacing: { after: 200 },
                        }),
                        ...imageLinks.map(
                          (image: any) =>
                            new DocxParagraph({
                              children: [
                                new DocxTextRun({
                                  text: `• ${image.caption || "Untitled"}: ${
                                    image.url
                                  }`,
                                  size: 24,
                                }),
                              ],
                              spacing: { after: 200 },
                            })
                        ),
                      ]
                    : []),
                ]
              : []),

            // Discussion and Replies
            new DocxParagraph({
              text: `DISCUSSION AND REPLIES (${repliesWithUsers?.length || 0})`,
              heading: HeadingLevel?.HEADING_1,
              spacing: { before: 400, after: 200 },
            }),
            ...(repliesWithUsers && repliesWithUsers.length > 0
              ? repliesWithUsers.flatMap((reply: any) => [
                  new DocxParagraph({
                    children: [
                      new DocxTextRun({
                        text: `${
                          reply.user?.username ||
                          reply.user?.email ||
                          "Anonymous User"
                        }`,
                        bold: true,
                        size: 26,
                      }),
                      new DocxTextRun({
                        text: ` (${new Date(
                          reply.created_at
                        ).toLocaleDateString()})`,
                        italics: true,
                        size: 22,
                      }),
                    ],
                    spacing: { after: 100 },
                  }),
                  new DocxParagraph({
                    children: [
                      new DocxTextRun({
                        text: reply.content,
                        size: 24,
                      }),
                    ],
                    spacing: { after: 400 },
                  }),
                ])
              : [
                  new DocxParagraph({
                    children: [
                      new DocxTextRun({
                        text: "No replies or discussion available.",
                        italics: true,
                        size: 24,
                      }),
                    ],
                    spacing: { after: 300 },
                  }),
                ]),

            // Document Footer
            new DocxParagraph({
              text: "END OF DOCUMENT",
              heading: HeadingLevel?.HEADING_2,
              spacing: { before: 600, after: 200 },
            }),
            new DocxParagraph({
              children: [
                new DocxTextRun({
                  text: "This document contains a comprehensive export of the Multi-pak Stick including all content, media, and discussion threads. Generated automatically by Stick My Note application.",
                  italics: true,
                  size: 20,
                }),
              ],
              spacing: { after: 200 },
            }),
          ],
        },
      ],
    });

    const buffer = await DocxPacker.toBuffer(doc);

    const filename = generateExportFilename(stickDataWithPads.topic);

    // Save to local public/exports directory
    const exportsDir = path.join(process.cwd(), "public", "exports");
    await mkdir(exportsDir, { recursive: true });
    const filePath = path.join(exportsDir, filename);
    await writeFile(filePath, Buffer.from(buffer));

    // Generate URL for local file
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const fileUrl = `${baseUrl}/exports/${filename}`;

    const exportLink = buildExportLink(fileUrl, filename);

    await saveExportLink(db, stickId, user.id, stickOrgId, exportLink);

    return NextResponse.json({
      success: true,
      exportUrl: fileUrl,
      filename: filename,
      message: "Complete stick export generated successfully",
    });
  } catch (error) {
    console.error("Export stick error:", error);
    return NextResponse.json(
      { error: `Failed to export stick: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}

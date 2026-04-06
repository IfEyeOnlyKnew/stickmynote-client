// Shared handler logic for stick export (v1 + v2 deduplication)

export interface ExportLink {
  url: string
  filename: string
  created_at: string
  type: string
}

export interface StickData {
  id: string
  topic?: string
  content?: string
  created_at: string
  updated_at?: string
  pad_id: string
  pads?: {
    name?: string
    multi_pak_id?: string
    owner_id?: string
    multi_paks?: { owner_id?: string }
  }
}

export interface Reply {
  created_at: string
  content: string
  user?: { username?: string; email?: string }
}

export interface MediaLink {
  title?: string
  caption?: string
  url?: string
  embed_url?: string
}

export const toneInstructions: Record<string, string> = {
  professional:
    "Provide a professional, structured summary suitable for a business report. Use clear, objective language and organize key points logically with distinct paragraphs for different topics.",
  casual:
    "Write this summary in a conversational, friendly tone as if explaining to a friend. Use everyday language and focus on the main takeaways. Break into natural conversation paragraphs.",
  friendly:
    "Write this summary in a warm, approachable tone that's professional yet personable. Focus on collaboration and positive outcomes with clear paragraph breaks.",
  formal:
    "Provide a formal, detailed summary with precise language suitable for official documentation. Structure with clear sections and comprehensive coverage of all topics.",
}

export function getTonePrompt(tone: string): string {
  return toneInstructions[tone] || toneInstructions.professional
}

export function parseTabData(tabData: unknown): MediaLink[] {
  try {
    const data = typeof tabData === "string" ? JSON.parse(tabData) : tabData
    return data?.videos || data?.images || []
  } catch {
    return []
  }
}

export function formatVideoLinks(videoTabs: Array<{ tab_data: unknown }>): MediaLink[] {
  return videoTabs.flatMap((tab) => {
    const videos = parseTabData(tab.tab_data)
    return videos.map((video: MediaLink) => ({
      ...video,
      embed_url: video.embed_url || video.url,
    }))
  })
}

export function formatImageLinks(imageTabs: Array<{ tab_data: unknown }>): MediaLink[] {
  return imageTabs.flatMap((tab) => parseTabData(tab.tab_data))
}

export function sanitizeTopicForFilename(topic: string | undefined): string {
  return (topic || "Untitled")
    .replaceAll(/[^a-zA-Z0-9\s-]/g, "")
    .replaceAll(/\s+/g, "-")
    .toLowerCase()
    .substring(0, 50)
}

export function generateExportFilename(topic: string | undefined): string {
  return `${sanitizeTopicForFilename(topic)}-export-${Date.now()}.docx`
}

export function buildExportLink(url: string, filename: string): ExportLink {
  return {
    url,
    filename,
    created_at: new Date().toISOString(),
    type: "complete_export",
  }
}

// Initialize docx module dynamically (shared between v1 and v2)
export async function initializeDocxModules() {
  try {
    const docxModule = await import("docx")
    return {
      Document: docxModule.Document,
      Packer: docxModule.Packer,
      Paragraph: docxModule.Paragraph,
      TextRun: docxModule.TextRun,
      HeadingLevel: docxModule.HeadingLevel,
    }
  } catch {
    return null
  }
}

// Split summary text into paragraphs for DOCX
export function splitSummaryIntoParagraphs(summary: string): string[] {
  return summary
    .split(/\n\n+/)
    .filter((paragraph: string) => paragraph.trim().length > 0)
    .map((paragraph: string) => paragraph.trim())
}

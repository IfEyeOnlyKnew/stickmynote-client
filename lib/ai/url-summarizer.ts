/**
 * URL Content Summarizer
 *
 * Fetches content from URLs and generates AI summaries using the configured provider.
 * Uses Mozilla Readability for article extraction to get clean, readable content.
 */

import { JSDOM } from "jsdom"
import { Readability } from "@mozilla/readability"
import https from "node:https"
import http from "node:http"
import { generateText, isAIAvailable, getProviderDisplayName } from "./ai-provider"

/**
 * Fetch URL content using Node.js http/https modules for better reliability
 */
async function fetchUrlContent(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url)
    const isHttps = parsedUrl.protocol === "https:"
    const client = isHttps ? https : http

    const options: https.RequestOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      timeout: 15000,
      rejectUnauthorized: false, // Allow self-signed certs in dev
    }

    const req = client.request(options, (res) => {
      // Handle redirects
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const redirectUrl = new URL(res.headers.location, url).toString()
        console.log(`[URL Summarizer] Redirecting to: ${redirectUrl}`)
        fetchUrlContent(redirectUrl).then(resolve).catch(reject)
        return
      }

      if (res.statusCode && res.statusCode >= 400) {
        reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`))
        return
      }

      let data = ""
      res.setEncoding("utf8")
      res.on("data", (chunk) => {
        data += chunk
      })
      res.on("end", () => {
        resolve(data)
      })
    })

    req.on("error", (error) => {
      reject(error)
    })

    req.on("timeout", () => {
      req.destroy()
      reject(new Error("Request timed out"))
    })

    req.end()
  })
}

export interface UrlContent {
  url: string
  title: string
  content: string
  excerpt?: string
  byline?: string
  siteName?: string
  error?: string
}

export interface UrlSummary {
  url: string
  title: string
  summary: string
  error?: string
}

export interface LinkSummaryResult {
  summaries: UrlSummary[]
  combinedSummary: string
  provider: string
  errors: string[]
}

/**
 * Fallback content extraction when Readability fails or content is too short
 */
function extractFallbackContent(html: string, url: string): UrlContent {
  const titleMatch = /<title[^>]*>([^<]*)<\/title>/i.exec(html)
  const title = titleMatch ? titleMatch[1].trim() : new URL(url).hostname

  const descMatch = /<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i.exec(html) ||
                    /<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["']/i.exec(html)
  const description = descMatch ? descMatch[1].trim() : ""

  if (description) {
    console.log(`[URL Summarizer] Using meta description for ${url}`)
    return { url, title, content: description, excerpt: description }
  }

  console.log(`[URL Summarizer] Could not extract content from ${url}`)
  return {
    url,
    title,
    content: "",
    error: "Could not extract article content (may be video, login-required, or dynamic page)",
  }
}

/**
 * Extract readable content from a URL using Mozilla Readability
 */
export async function extractUrlContent(url: string): Promise<UrlContent> {
  try {
    console.log(`[URL Summarizer] Fetching: ${url}`)

    // Use our custom fetch function for better reliability
    const html = await fetchUrlContent(url)
    console.log(`[URL Summarizer] Got ${html.length} chars from ${url}`)

    // Parse with JSDOM and extract with Readability
    const dom = new JSDOM(html, { url })
    const reader = new Readability(dom.window.document)
    const article = reader.parse()

    if (!article?.textContent || article.textContent.trim().length < 100) {
      return extractFallbackContent(html, url)
    }

    console.log(`[URL Summarizer] Extracted ${article.textContent.length} chars from ${url}`)
    return {
      url,
      title: article.title || new URL(url).hostname,
      content: article.textContent || "",
      excerpt: article.excerpt || undefined,
      byline: article.byline || undefined,
      siteName: article.siteName || undefined,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    console.error(`[URL Summarizer] Error fetching ${url}:`, errorMessage)

    // Provide more helpful error messages
    let friendlyError = errorMessage
    if (errorMessage.includes("abort")) {
      friendlyError = "Request timed out (site may be slow or blocking requests)"
    } else if (errorMessage.includes("ENOTFOUND") || errorMessage.includes("getaddrinfo")) {
      friendlyError = "Could not resolve domain name"
    } else if (errorMessage.includes("ECONNREFUSED")) {
      friendlyError = "Connection refused by server"
    } else if (errorMessage.includes("certificate") || errorMessage.includes("SSL") || errorMessage.includes("TLS")) {
      friendlyError = "SSL/TLS certificate error"
    } else if (errorMessage.includes("fetch failed")) {
      friendlyError = "Network request failed (check internet connection or firewall)"
    }

    return {
      url,
      title: "",
      content: "",
      error: friendlyError,
    }
  }
}

/**
 * Summarize content from a single URL
 */
export async function summarizeUrl(url: string, title: string): Promise<UrlSummary> {
  const urlContent = await extractUrlContent(url)

  if (urlContent.error || !urlContent.content) {
    console.log(`[URL Summarizer] Skipping AI for ${url}: ${urlContent.error || "No content"}`)
    return {
      url,
      title: title || urlContent.title || new URL(url).hostname,
      summary: "",
      error: urlContent.error || "No content found",
    }
  }

  // Truncate content to avoid token limits (roughly 4000 chars = ~1000 tokens)
  const truncatedContent = urlContent.content.substring(0, 4000)

  try {
    console.log(`[URL Summarizer] Calling AI for ${url} (${truncatedContent.length} chars)`)
    const { text } = await generateText({
      prompt: `Summarize the following article in 2-3 concise sentences. Focus on the key points and main takeaways.

Title: ${urlContent.title}
Content: ${truncatedContent}

Summary:`,
      maxTokens: 200,
      temperature: 0.3,
    })

    console.log(`[URL Summarizer] AI response for ${url}: ${text.substring(0, 100)}...`)
    return {
      url,
      title: title || urlContent.title,
      summary: text.trim(),
    }
  } catch (error) {
    console.error(`[URL Summarizer] AI error for ${url}:`, error)
    return {
      url,
      title: title || urlContent.title,
      summary: "",
      error: error instanceof Error ? error.message : "Failed to generate summary",
    }
  }
}

/**
 * Summarize multiple URLs and generate a combined summary
 */
export async function summarizeLinks(
  links: Array<{ url: string; title: string }>
): Promise<LinkSummaryResult> {
  if (!isAIAvailable()) {
    return {
      summaries: [],
      combinedSummary: "",
      provider: "none",
      errors: ["No AI provider configured. Set OLLAMA_MODEL, AZURE_OPENAI_API_KEY, or other provider credentials."],
    }
  }

  const provider = getProviderDisplayName()
  const errors: string[] = []
  const summaries: UrlSummary[] = []

  // Process links in parallel (max 5 concurrent)
  const batchSize = 5
  for (let i = 0; i < links.length; i += batchSize) {
    const batch = links.slice(i, i + batchSize)
    const batchResults = await Promise.all(
      batch.map((link) => summarizeUrl(link.url, link.title))
    )

    for (const result of batchResults) {
      summaries.push(result)
      if (result.error) {
        errors.push(`${result.title}: ${result.error}`)
      }
    }
  }

  // Generate combined summary from successful summaries
  const successfulSummaries = summaries.filter((s) => s.summary && !s.error)
  let combinedSummary = ""

  if (successfulSummaries.length > 0) {
    const summaryText = successfulSummaries
      .map((s) => `**${s.title}**: ${s.summary}`)
      .join("\n\n")

    try {
      const { text } = await generateText({
        prompt: `Based on the following article summaries, create a comprehensive overview that synthesizes the key information. Write in a clear, informative style.

${summaryText}

Comprehensive Overview:`,
        maxTokens: 500,
        temperature: 0.4,
      })

      combinedSummary = text.trim()
    } catch (error) {
      console.error("[URL Summarizer] Combined summary failed:", error)
      combinedSummary = summaryText
      errors.push("Could not generate combined summary, showing individual summaries")
    }
  }

  return {
    summaries,
    combinedSummary,
    provider,
    errors,
  }
}

/**
 * Format link summaries as HTML for the Details tab
 */
export function formatSummariesAsHtml(result: LinkSummaryResult): string {
  const sections: string[] = []

  // Add header
  sections.push(
    `<h3>Link Summary</h3>`,
    `<p><em>Generated using ${result.provider}</em></p>`,
  )

  // Add combined summary if available
  if (result.combinedSummary) {
    sections.push(
      `<h4>Overview</h4>`,
      `<p>${result.combinedSummary}</p>`,
    )
  }

  // Add individual summaries
  if (result.summaries.length > 0) {
    sections.push(
      `<h4>Individual Summaries</h4>`,
      `<ul>`,
    )

    for (const summary of result.summaries) {
      if (summary.summary) {
        sections.push(
          `<li><strong><a href="${summary.url}" target="_blank" rel="noopener noreferrer">${summary.title}</a></strong>: ${summary.summary}</li>`
        )
      } else if (summary.error) {
        sections.push(
          `<li><strong><a href="${summary.url}" target="_blank" rel="noopener noreferrer">${summary.title}</a></strong>: <em>Could not summarize: ${summary.error}</em></li>`
        )
      }
    }

    sections.push(`</ul>`)
  }

  // Add errors section if any
  if (result.errors.length > 0) {
    sections.push(`<p><small>Note: Some links could not be processed.</small></p>`)
  }

  return sections.join("\n")
}

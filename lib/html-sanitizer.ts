import DOMPurify from "isomorphic-dompurify"

/**
 * Strict HTML Sanitization Configuration
 *
 * Security-first approach with minimal allowed tags and attributes.
 * All user-generated HTML must pass through this sanitizer.
 */

export const SANITIZE_CONFIG_STRICT = {
  ALLOWED_TAGS: [
    "p",
    "br",
    "strong",
    "em",
    "u",
    "ol",
    "ul",
    "li",
    "a",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "blockquote",
    "code",
    "pre",
  ],
  ALLOWED_ATTR: ["href", "title", "target", "rel"],
  ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
  ALLOW_DATA_ATTR: false,
  ALLOW_UNKNOWN_PROTOCOLS: false,
  SAFE_FOR_TEMPLATES: true,
  WHOLE_DOCUMENT: false,
  RETURN_DOM: false,
  RETURN_DOM_FRAGMENT: false,
  FORCE_BODY: false,
  SANITIZE_DOM: true,
  KEEP_CONTENT: true,
  IN_PLACE: false,
}

export const SANITIZE_CONFIG_RICH_TEXT = {
  ...SANITIZE_CONFIG_STRICT,
  ALLOWED_TAGS: [...SANITIZE_CONFIG_STRICT.ALLOWED_TAGS, "img", "table", "thead", "tbody", "tr", "th", "td"],
  ALLOWED_ATTR: [
    ...SANITIZE_CONFIG_STRICT.ALLOWED_ATTR,
    "src",
    "alt",
    "class", // For styling tables and images
  ],
}

export const SANITIZE_CONFIG_MINIMAL = {
  ALLOWED_TAGS: ["b", "i", "em", "strong", "p", "br"],
  ALLOWED_ATTR: [],
  ALLOW_DATA_ATTR: false,
  ALLOW_UNKNOWN_PROTOCOLS: false,
  SAFE_FOR_TEMPLATES: true,
}

/**
 * Sanitize HTML with strict security settings
 * Use for user-generated content that should support basic formatting
 */
export function sanitizeHtml(html: string): string {
  if (!html || typeof html !== "string") {
    return ""
  }
  return DOMPurify.sanitize(html, SANITIZE_CONFIG_STRICT)
}

/**
 * Sanitize rich text editor content (TipTap output)
 * Allows images and tables but still enforces strict security
 */
export function sanitizeRichText(html: string): string {
  if (!html || typeof html !== "string") {
    return ""
  }
  return DOMPurify.sanitize(html, SANITIZE_CONFIG_RICH_TEXT)
}

/**
 * Sanitize to plain text with minimal formatting
 * Use for replies, comments, and short-form content
 */
export function sanitizeMinimal(html: string): string {
  if (!html || typeof html !== "string") {
    return ""
  }
  return DOMPurify.sanitize(html, SANITIZE_CONFIG_MINIMAL)
}

/**
 * Strip all HTML tags and return plain text
 * Use when no HTML should be allowed at all
 */
export function stripHtml(html: string): string {
  if (!html || typeof html !== "string") {
    return ""
  }
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true,
  })
}

/**
 * Validate and sanitize URL
 * Returns empty string if URL is invalid or potentially dangerous
 */
export function sanitizeUrl(url: string): string {
  if (!url || typeof url !== "string") {
    return ""
  }

  // Check against allowed protocols
  const allowedProtocols = ["http:", "https:", "mailto:", "tel:"]
  try {
    const parsed = new URL(url)
    if (!allowedProtocols.includes(parsed.protocol)) {
      return ""
    }
    return url
  } catch {
    // Invalid URL
    return ""
  }
}

/**
 * Server-side sanitization middleware
 * Call this on all API routes that accept HTML content
 */
export function sanitizeRequestBody<T extends Record<string, any>>(
  body: T,
  htmlFields: (keyof T)[],
  richTextFields: (keyof T)[] = [],
): T {
  const sanitized = { ...body }

  for (const field of htmlFields) {
    if (typeof sanitized[field] === "string") {
      sanitized[field] = sanitizeHtml(sanitized[field] as string) as T[keyof T]
    }
  }

  for (const field of richTextFields) {
    if (typeof sanitized[field] === "string") {
      sanitized[field] = sanitizeRichText(sanitized[field] as string) as T[keyof T]
    }
  }

  return sanitized
}

import DOMPurify from "isomorphic-dompurify"
import { sanitizeRichText } from "@/lib/html-sanitizer"

interface SafeHtmlRendererProps {
  content: string
  className?: string
  mode?: "strict" | "rich-text"
}

export function SafeHtmlRenderer({ content, className = "", mode = "rich-text" }: SafeHtmlRendererProps) {
  if (!content || content === "<p></p>") {
    return null
  }

  const sanitizedContent =
    mode === "rich-text"
      ? sanitizeRichText(content)
      : DOMPurify.sanitize(content, {
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
        })

  return (
    <div className={`prose prose-sm max-w-none ${className}`} dangerouslySetInnerHTML={{ __html: sanitizedContent }} />
  )
}

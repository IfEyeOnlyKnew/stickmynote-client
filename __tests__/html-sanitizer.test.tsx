import { describe, it, expect } from "@jest/globals"
import {
  sanitizeHtml,
  sanitizeRichText,
  sanitizeMinimal,
  stripHtml,
  sanitizeUrl,
  sanitizeRequestBody,
} from "../lib/html-sanitizer"

describe("HTML Sanitizer", () => {
  describe("sanitizeHtml", () => {
    it("should allow safe HTML tags", () => {
      const input = "<p>Hello <strong>world</strong></p>"
      const output = sanitizeHtml(input)
      expect(output).toContain("<p>")
      expect(output).toContain("<strong>")
    })

    it("should remove script tags", () => {
      const input = '<p>Hello</p><script>alert("XSS")</script>'
      const output = sanitizeHtml(input)
      expect(output).not.toContain("<script>")
      expect(output).not.toContain("alert")
    })

    it("should remove event handlers", () => {
      const input = "<p onclick=\"alert('XSS')\">Click me</p>"
      const output = sanitizeHtml(input)
      expect(output).not.toContain("onclick")
    })

    it("should remove javascript: URLs", () => {
      const input = "<a href=\"javascript:alert('XSS')\">Click</a>"
      const output = sanitizeHtml(input)
      expect(output).not.toContain("javascript:")
    })

    it("should allow safe links", () => {
      const input = '<a href="https://example.com">Link</a>'
      const output = sanitizeHtml(input)
      expect(output).toContain('href="https://example.com"')
    })

    it("should handle empty input", () => {
      expect(sanitizeHtml("")).toBe("")
      expect(sanitizeHtml(null as any)).toBe("")
      expect(sanitizeHtml(undefined as any)).toBe("")
    })
  })

  describe("sanitizeRichText", () => {
    it("should allow images with safe attributes", () => {
      const input = '<img src="https://example.com/image.jpg" alt="Test">'
      const output = sanitizeRichText(input)
      expect(output).toContain("<img")
      expect(output).toContain('src="https://example.com/image.jpg"')
    })

    it("should allow tables", () => {
      const input = "<table><tr><td>Cell</td></tr></table>"
      const output = sanitizeRichText(input)
      expect(output).toContain("<table>")
      expect(output).toContain("<td>")
    })

    it("should remove onerror from images", () => {
      const input = '<img src="x" onerror="alert(\'XSS\')">'
      const output = sanitizeRichText(input)
      expect(output).not.toContain("onerror")
    })
  })

  describe("sanitizeMinimal", () => {
    it("should only allow basic formatting", () => {
      const input = "<p><strong>Bold</strong> and <em>italic</em></p>"
      const output = sanitizeMinimal(input)
      expect(output).toContain("<strong>")
      expect(output).toContain("<em>")
    })

    it("should remove links", () => {
      const input = '<a href="https://example.com">Link</a>'
      const output = sanitizeMinimal(input)
      expect(output).not.toContain("<a")
      expect(output).toContain("Link")
    })

    it("should remove images", () => {
      const input = '<img src="https://example.com/image.jpg">'
      const output = sanitizeMinimal(input)
      expect(output).not.toContain("<img")
    })
  })

  describe("stripHtml", () => {
    it("should remove all HTML tags", () => {
      const input = "<p>Hello <strong>world</strong></p>"
      const output = stripHtml(input)
      expect(output).toBe("Hello world")
    })

    it("should handle nested tags", () => {
      const input = "<div><p><span>Text</span></p></div>"
      const output = stripHtml(input)
      expect(output).toBe("Text")
    })
  })

  describe("sanitizeUrl", () => {
    it("should allow https URLs", () => {
      const url = "https://example.com"
      expect(sanitizeUrl(url)).toBe(url)
    })

    it("should allow http URLs", () => {
      const url = "http://example.com"
      expect(sanitizeUrl(url)).toBe(url)
    })

    it("should allow mailto URLs", () => {
      const url = "mailto:test@example.com"
      expect(sanitizeUrl(url)).toBe(url)
    })

    it("should block javascript URLs", () => {
      const url = "javascript:alert('XSS')"
      expect(sanitizeUrl(url)).toBe("")
    })

    it("should block data URLs", () => {
      const url = "data:text/html,<script>alert('XSS')</script>"
      expect(sanitizeUrl(url)).toBe("")
    })

    it("should handle invalid URLs", () => {
      expect(sanitizeUrl("not a url")).toBe("")
      expect(sanitizeUrl("")).toBe("")
    })
  })

  describe("sanitizeRequestBody", () => {
    it("should sanitize specified HTML fields", () => {
      const body = {
        title: "<script>alert('XSS')</script>Hello",
        content: "<p>Safe content</p>",
        other: "unchanged",
      }
      const result = sanitizeRequestBody(body, ["title"], ["content"])
      expect(result.title).not.toContain("<script>")
      expect(result.content).toContain("<p>")
      expect(result.other).toBe("unchanged")
    })

    it("should handle missing fields", () => {
      const body = { title: "Hello" }
      const result = sanitizeRequestBody(body, ["title", "missing" as any])
      expect(result.title).toBe("Hello")
    })
  })
})

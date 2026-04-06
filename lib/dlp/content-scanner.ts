import "server-only"

/**
 * Built-in PII detection patterns for DLP content scanning.
 * Each pattern has a label, regex, and description.
 */

export interface PatternMatch {
  pattern: string
  label: string
  count: number
}

export interface ScanResult {
  hasSensitiveData: boolean
  matches: PatternMatch[]
}

interface BuiltInPattern {
  id: string
  label: string
  regex: RegExp
}

const BUILT_IN_PATTERNS: BuiltInPattern[] = [
  {
    id: "ssn",
    label: "Social Security Number",
    regex: /\b\d{3}-\d{2}-\d{4}\b/g,
  },
  {
    id: "credit_card",
    label: "Credit Card Number",
    // Visa, Mastercard, Amex, Discover — 13-19 digits with optional separators
    regex: /\b(?:4\d{3}|5[1-5]\d{2}|3[47]\d{2}|6\d{3})[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{1,7}\b/g,
  },
  {
    id: "phone_us",
    label: "Phone Number",
    regex: /\b(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g,
  },
  {
    id: "api_key",
    label: "API Key / Secret",
    // Matches long hex strings (32+ chars) or base64-like tokens prefixed with common key identifiers
    regex: /\b(?:sk|pk|api|key|token|secret|password)[_-]?\w{20,}\b/gi,
  },
  {
    id: "ip_address",
    label: "IP Address",
    regex: /\b(?:(?:25[0-5]|2[0-4]\d|1?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|1?\d\d?)\b/g,
  },
]

/**
 * Scan text content for sensitive data patterns.
 *
 * @param text - The content to scan
 * @param customPatterns - Optional additional regex patterns (as strings)
 * @returns ScanResult with match details
 */
export function scanContent(text: string, customPatterns?: string[]): ScanResult {
  if (!text || text.trim().length === 0) {
    return { hasSensitiveData: false, matches: [] }
  }

  const matches: PatternMatch[] = [
    ...scanBuiltInPatterns(text),
    ...scanCustomPatterns(text, customPatterns),
  ]

  return { hasSensitiveData: matches.length > 0, matches }
}

function scanBuiltInPatterns(text: string): PatternMatch[] {
  const matches: PatternMatch[] = []
  for (const pattern of BUILT_IN_PATTERNS) {
    pattern.regex.lastIndex = 0
    const found = text.match(pattern.regex)
    if (found?.length) {
      matches.push({ pattern: pattern.id, label: pattern.label, count: found.length })
    }
  }
  return matches
}

function scanCustomPatterns(text: string, customPatterns?: string[]): PatternMatch[] {
  if (!customPatterns?.length) return []

  const matches: PatternMatch[] = []
  for (const patternStr of customPatterns) {
    try {
      const regex = new RegExp(patternStr, "gi")
      const found = text.match(regex)
      if (found?.length) {
        matches.push({ pattern: "custom", label: `Custom pattern: ${patternStr.slice(0, 30)}`, count: found.length })
      }
    } catch {
      // Skip invalid regex patterns silently
    }
  }
  return matches
}

/**
 * Get the list of built-in pattern IDs for UI display.
 */
export function getBuiltInPatternIds(): { id: string; label: string }[] {
  return BUILT_IN_PATTERNS.map((p) => ({ id: p.id, label: p.label }))
}

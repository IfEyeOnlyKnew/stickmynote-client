import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Escape regex metacharacters so a user-supplied string can be safely used
// inside a RegExp constructor. Prevents ReDoS and broken patterns when the
// input contains characters like ( ) [ ] . * + ? | \ etc.
export function escapeRegExp(input: string): string {
  return input.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

// Strip HTML tags from a string using a single linear pass. Replaces the
// regex `/<[^>]*>/g` used in many preview/excerpt code paths. SonarQube
// S5852 flags unbounded `[^>]*` repetition as ReDoS-sensitive; this
// character-by-character implementation is O(n) by construction and cannot
// backtrack at all.
//
// The default maxLen of 10_000 is plenty for excerpt/preview use cases and
// puts a hard ceiling on the work performed per call.
export function stripHtmlTags(html: string | null | undefined, maxLen = 10_000): string {
  if (!html) return ""
  const bounded = html.length > maxLen ? html.slice(0, maxLen) : html
  const out: string[] = []
  let inTag = false
  for (let i = 0; i < bounded.length; i++) {
    const ch = bounded[i]
    if (ch === "<") {
      inTag = true
    } else if (ch === ">") {
      inTag = false
    } else if (!inTag) {
      out.push(ch)
    }
  }
  return out.join("")
}

// Validate an email address using linear string operations only. Replaces
// `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` which SonarQube S5852 flags for having
// multiple `+` quantifiers on overlapping character classes.
//
// This is a structural check (exactly one `@`, non-empty local and domain,
// a dot in the domain, no whitespace, reasonable length) — NOT a full RFC
// 5322 validator. Good enough for invite forms and contact fields where we
// also verify delivery via a confirmation email anyway.
export function isValidEmail(email: string | null | undefined): boolean {
  if (!email) return false
  const e = email.trim()
  if (e.length === 0 || e.length > 254) return false

  // No whitespace anywhere (single O(n) scan)
  for (let i = 0; i < e.length; i++) {
    const c = e.charCodeAt(i)
    // space, tab, LF, CR, VT, FF
    if (c === 32 || c === 9 || c === 10 || c === 13 || c === 11 || c === 12) return false
  }

  const at = e.indexOf("@")
  if (at < 1) return false
  if (e.indexOf("@", at + 1) !== -1) return false // more than one @

  const local = e.substring(0, at)
  const domain = e.substring(at + 1)
  if (local.length === 0 || domain.length === 0) return false
  if (domain.length > 253) return false

  const dot = domain.indexOf(".")
  if (dot < 1) return false
  if (domain.startsWith(".") || domain.endsWith(".")) return false

  return true
}

// Scan a regex pattern string for nested-quantifier shapes like (a+)+,
// (.*)* etc. — the classic catastrophic-backtracking signature. Returns
// true if the pattern looks unsafe. Used to validate admin-configured
// DLP patterns before compiling/running them.
//
// Implemented as a character-by-character scan (no regex) so SonarQube
// can't flag *this* function itself under S5852.
export function hasNestedQuantifier(pattern: string): boolean {
  let depth = 0
  // Track whether any `+`/`*`/`{n,}` quantifier appeared since the current
  // group's opening paren. If yes, a closing `)` followed by `+`/`*`/`{n,}`
  // means we have nested repetition.
  const innerQuantifierStack: boolean[] = []

  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i]

    if (ch === "\\") {
      i++ // skip escaped character
      continue
    }

    if (ch === "[") {
      // skip character class
      i++
      while (i < pattern.length && pattern[i] !== "]") {
        if (pattern[i] === "\\") i++
        i++
      }
      continue
    }

    if (ch === "(") {
      depth++
      innerQuantifierStack.push(false)
      continue
    }

    if (ch === ")") {
      const hadInner = innerQuantifierStack.pop() ?? false
      depth = Math.max(0, depth - 1)
      const next = pattern[i + 1]
      if (hadInner && (next === "+" || next === "*" || next === "{")) {
        return true
      }
      continue
    }

    if (ch === "+" || ch === "*" || ch === "{") {
      if (depth > 0) {
        innerQuantifierStack[innerQuantifierStack.length - 1] = true
      }
    }
  }

  return false
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60

  if (h > 0) {
    return `${h}h ${m}m ${s}s`
  }
  if (m > 0) {
    return `${m}m ${s}s`
  }
  return `${s}s`
}

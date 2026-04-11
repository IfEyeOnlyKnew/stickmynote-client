import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Escape regex metacharacters so a user-supplied string can be safely used
// inside a RegExp constructor. Prevents ReDoS and broken patterns when the
// input contains characters like ( ) [ ] . * + ? | \ etc.
export function escapeRegExp(input: string): string {
  return input.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`)
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
  for (const ch of bounded) {
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

// Codepoints SonarCloud wants us to treat as whitespace for email validation.
// Kept as a frozen set so the hot path uses Set#has (O(1)) instead of a
// chain of === comparisons.
const EMAIL_DISALLOWED_WHITESPACE = new Set<number>([
  32, // space
  9,  // tab
  10, // LF
  13, // CR
  11, // VT
  12, // FF
])

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

  // No whitespace anywhere (single O(n) scan). for-of iterates code points,
  // so `ch.codePointAt(0)` is correct even for astral characters.
  for (const ch of e) {
    const c = ch.codePointAt(0) ?? 0
    if (EMAIL_DISALLOWED_WHITESPACE.has(c)) return false
  }

  const at = e.indexOf("@")
  if (at < 1) return false
  if (e.substring(at + 1).includes("@")) return false // more than one @

  const local = e.substring(0, at)
  const domain = e.substring(at + 1)
  if (local.length === 0 || domain.length === 0) return false
  if (domain.length > 253) return false

  if (!domain.includes(".")) return false
  if (domain.startsWith(".") || domain.endsWith(".")) return false

  return true
}

// --- hasNestedQuantifier: scanner with small helpers so each step stays
// simple enough to keep cognitive complexity under SonarCloud's S3776 limit.

// Returns the index of the closing `]` of a character class that starts at
// pattern[i] (which must be `[`). Backslash-escaped characters inside the
// class are skipped. If no `]` is found, returns pattern.length.
function skipCharClass(pattern: string, start: number): number {
  let i = start + 1
  while (i < pattern.length && pattern[i] !== "]") {
    if (pattern[i] === "\\") i++
    i++
  }
  return i
}

// True if the character at index i is a top-level repetition quantifier
// (`+`, `*`, or the start of a `{n,m}` quantifier).
function isRepetitionQuantifier(ch: string | undefined): boolean {
  return ch === "+" || ch === "*" || ch === "{"
}

// Per-character dispatch for hasNestedQuantifier. Returns either:
//   { found: true }                      — nested repetition detected, stop
//   { found: false, nextIndex: number }  — continue scanning from nextIndex
// Splitting the main loop's branching into this helper keeps the loop body
// to a single switch-like expression, satisfying S3776 cognitive complexity.
function scanQuantifierStep(
  pattern: string,
  i: number,
  stack: boolean[],
): { found: true } | { found: false; nextIndex: number } {
  const ch = pattern[i]

  if (ch === "\\") return { found: false, nextIndex: i + 2 }

  if (ch === "[") return { found: false, nextIndex: skipCharClass(pattern, i) + 1 }

  if (ch === "(") {
    stack.push(false)
    return { found: false, nextIndex: i + 1 }
  }

  if (ch === ")") {
    const hadInner = stack.pop() ?? false
    if (hadInner && isRepetitionQuantifier(pattern[i + 1])) return { found: true }
    return { found: false, nextIndex: i + 1 }
  }

  if (isRepetitionQuantifier(ch) && stack.length > 0) {
    stack[stack.length - 1] = true
  }
  return { found: false, nextIndex: i + 1 }
}

// Scan a regex pattern string for nested-quantifier shapes like (a+)+,
// (.*)* etc. — the classic catastrophic-backtracking signature. Returns
// true if the pattern looks unsafe. Used to validate admin-configured
// DLP patterns before compiling/running them.
//
// Implemented as a character-by-character scan (no regex) so SonarCloud
// can't flag *this* function itself under S5852.
export function hasNestedQuantifier(pattern: string): boolean {
  // stack[d] === true means some quantifier has been seen inside the
  // currently-open group at depth d. A closing `)` followed by `+`/`*`/`{`
  // on a group where that flag is true is nested repetition.
  const stack: boolean[] = []
  let i = 0
  while (i < pattern.length) {
    const step = scanQuantifierStep(pattern, i, stack)
    if (step.found) return true
    i = step.nextIndex
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

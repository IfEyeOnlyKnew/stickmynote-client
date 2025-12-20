// Input validation helpers for StickMyNote API
export function requireString(val: any, field: string): string {
  if (typeof val !== 'string' || !val.trim()) throw new Error(`${field} is required`)
  return val.trim()
}

export function requireId(val: any, field: string): string {
  if (typeof val !== 'string' || val.trim().length === 0) throw new Error(`${field} is invalid`)
  // Accept UUIDs (with hyphens) and other ID formats
  const trimmed = val.trim()
  if (!/^[\w-]{8,}$/.test(trimmed)) throw new Error(`${field} is invalid`)
  return trimmed
}

export function requireBoolean(val: any, field: string): boolean {
  if (typeof val !== 'boolean') throw new Error(`${field} must be boolean`)
  return val
}

export function requireOptionalString(val: any): string|null {
  if (val == null) return null
  if (typeof val !== 'string') throw new Error('Invalid string')
  return val.trim() || null
}

import type { z } from "zod"
import { sanitizeMinimal } from "./html-sanitizer"
import {
  noteSchema,
  replySchema,
  tagSchema,
  noteTabSchema,
  userProfileSchema,
  rateLimitSchema,
  searchSchema,
} from "@/types/schemas"

// Sanitization function
export function sanitizeHtml(html: string): string {
  return sanitizeMinimal(html)
}

// Combined sanitize and validate function
export function sanitizeAndValidate<T>(data: unknown, schema: z.ZodSchema<T>): T {
  // First sanitize any string fields
  const sanitizedData = sanitizeData(data)

  // Then validate with the schema
  const result = schema.safeParse(sanitizedData)

  if (!result.success) {
    throw new Error(`Validation failed: ${result.error.message}`)
  }

  return result.data
}

// Helper function to recursively sanitize data
function sanitizeData(data: unknown): unknown {
  if (typeof data === "string") {
    return sanitizeHtml(data)
  }

  if (Array.isArray(data)) {
    return data.map(sanitizeData)
  }

  if (data && typeof data === "object") {
    const sanitized: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(data)) {
      sanitized[key] = sanitizeData(value)
    }
    return sanitized
  }

  return data
}

// Validation helper functions
export function validateNote(data: unknown) {
  return sanitizeAndValidate(data, noteSchema)
}

export function validateReply(data: unknown) {
  return sanitizeAndValidate(data, replySchema)
}

export function validateTag(data: unknown) {
  return sanitizeAndValidate(data, tagSchema)
}

export function validateNoteTab(data: unknown) {
  return sanitizeAndValidate(data, noteTabSchema)
}

export function validateUserProfile(data: unknown) {
  return sanitizeAndValidate(data, userProfileSchema)
}

export function validateRateLimit(data: unknown) {
  return sanitizeAndValidate(data, rateLimitSchema)
}

export function validateSearch(data: unknown) {
  return sanitizeAndValidate(data, searchSchema)
}

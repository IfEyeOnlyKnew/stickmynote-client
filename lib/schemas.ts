import { z } from "zod"
import {
  createNoteSchema as baseCreateNoteSchema,
  updateNoteSchema as baseUpdateNoteSchema,
  createReplySchema as baseCreateReplySchema,
  updateReplySchema as baseUpdateReplySchema,
  noteTabSchema as baseNoteTabSchema,
  uuidSchema,
  colorSchema,
} from "@/types/schemas"

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

// Basic validation schemas
export const emailSchema = z
  .string()
  .email("Please enter a valid email address")
  .min(1, "Email is required")
  .max(255, "Email must be less than 255 characters")

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters long")
  .max(128, "Password must be less than 128 characters")
  .regex(/[a-zA-Z]/, "Password must contain at least one letter")
  .regex(/[0-9]/, "Password must contain at least one number")
  .regex(/[^a-zA-Z0-9]/, "Password must contain at least one special character")

export const usernameSchema = z
  .string()
  .min(2, "Username must be at least 2 characters long")
  .max(50, "Username must be less than 50 characters")
  .regex(/^[a-zA-Z0-9_-]+$/, "Username can only contain letters, numbers, underscores, and hyphens")

// Note validation schemas
export const noteValidation = z.object({
  topic: z.string().max(75, "Topic must be 75 characters or less").optional().default(""),
  content: z.string().min(1, "Content is required").max(1000, "Content must be 1000 characters or less"),
  color: colorSchema.optional(),
  position_x: z.number().min(0).optional().default(0),
  position_y: z.number().min(0).optional().default(0),
  is_shared: z.boolean().optional().default(false),
  tags: z.array(z.string()).optional().default([]),
  images: z.array(z.string()).optional().default([]),
  videos: z.array(z.string()).optional().default([]),
})

export const noteValidationPartial = noteValidation.partial()

export const noteTopicSchema = z.string().max(75, "Topic must be 75 characters or less").optional().default("")

export const noteContentSchema = z
  .string()
  .min(1, "Content is required")
  .max(1000, "Content must be 1000 characters or less")

export const noteColorSchema = colorSchema

export const notePositionSchema = z
  .object({
    x: z.number().min(0).max(10000),
    y: z.number().min(0).max(10000),
  })
  .optional()

// Reply validation schemas
export const replyValidation = z.object({
  note_id: uuidSchema,
  content: z.string().min(1, "Reply content is required").max(400, "Reply must be 400 characters or less"),
  color: colorSchema.optional(),
})

export const replyContentSchema = z
  .string()
  .min(1, "Reply content is required")
  .max(400, "Reply must be 400 characters or less")

// Tag validation schemas
export const tagValidationSchema = z
  .string()
  .min(1, "Tag cannot be empty")
  .max(50, "Tag must be less than 50 characters")
  .regex(/^[a-zA-Z0-9_-]+$/, "Tag can only contain letters, numbers, underscores, and hyphens")

// Note tab schemas
export const noteTabSchema = baseNoteTabSchema

// User validation schemas
export const userProfileSchema = z.object({
  username: usernameSchema.optional(),
  email: emailSchema.optional(),
  full_name: z.string().max(100, "Full name too long").optional(),
  avatar_url: z.string().url("Invalid URL").optional(),
  bio: z.string().max(500, "Bio must be 500 characters or less").optional().nullable(),
  website: z.string().url("Invalid website URL").optional().nullable(),
  location: z.string().max(100, "Location must be 100 characters or less").optional().nullable(),
})

// Auth validation schemas
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required"),
})

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  username: usernameSchema.optional(),
  full_name: z.string().max(100, "Full name too long").optional(),
})

export const resetPasswordSchema = z.object({
  email: emailSchema,
})

// Search validation schemas
export const searchQuerySchema = z
  .string()
  .min(1, "Search query is required")
  .max(100, "Search query must be less than 100 characters")

export const searchSchema = z.object({
  query: z.string().min(1, "Search query is required").max(100, "Search query must be 100 characters or less"),
  filters: z
    .object({
      shared_only: z.boolean().optional(),
      user_id: z.string().uuid().optional(),
      created_after: z.date().optional(),
      created_before: z.date().optional(),
    })
    .optional(),
})

// Rate limiting validation
export const rateLimitSchema = z.object({
  user_id: z.string().uuid(),
  action_type: z.string().min(1).max(50),
  window_start: z.date(),
  count: z.number().int().min(0),
})

// File upload validation
export const fileUploadValidation = z.object({
  file: z.instanceof(File),
  maxSize: z.number().default(5 * 1024 * 1024), // 5MB default
  allowedTypes: z.array(z.string()).default(["image/jpeg", "image/png", "image/gif", "image/webp"]),
})

// Export all validation schemas for easy access
export const validationSchemas = {
  note: noteValidation,
  reply: replyValidation,
  user: userProfileSchema,
  search: searchQuerySchema,
  login: loginSchema,
  register: registerSchema,
  resetPassword: resetPasswordSchema,
  rateLimit: rateLimitSchema,
  fileUpload: fileUploadValidation,
  createNote: baseCreateNoteSchema,
  updateNote: baseUpdateNoteSchema,
  createReply: baseCreateReplySchema,
  updateReply: baseUpdateReplySchema,
}

// UUID validation function
export function validateUUID(uuid: string): boolean {
  return UUID_REGEX.test(uuid)
}

export {
  noteSchema,
  createNoteSchema,
  updateNoteSchema,
  replySchema,
  createReplySchema,
  updateReplySchema,
  tagSchema,
  uuidSchema,
} from "@/types/schemas"

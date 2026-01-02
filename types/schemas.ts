import { z } from "zod"

// ============================================================================
// CONSTANTS & ENUMS
// ============================================================================

export const NOTE_COLORS = [
  { name: "Yellow", value: "#fef3c7" },
  { name: "Pink", value: "#fce7f3" },
  { name: "Blue", value: "#dbeafe" },
  { name: "Green", value: "#d1fae5" },
  { name: "Purple", value: "#e9d5ff" },
  { name: "Orange", value: "#fed7aa" },
  { name: "Red", value: "#fecaca" },
  { name: "Gray", value: "#f3f4f6" },
  { name: "White", value: "#ffffff" },
  { name: "Cyan", value: "#cffafe" },
  { name: "Indigo", value: "#e0e7ff" },
  { name: "Lime", value: "#ecfccb" },
] as const

export const NOTE_COLOR_VALUES = NOTE_COLORS.map((c) => c.value)

// ============================================================================
// BASE SCHEMAS
// ============================================================================

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export const uuidSchema = z.string().regex(UUID_REGEX, "Invalid UUID format")

export const colorSchema = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, "Invalid hex color format")
  .default("#fef3c7")

export const timestampSchema = z.string().datetime()

// ============================================================================
// USER SCHEMAS
// ============================================================================

export const userSchema = z.object({
  id: uuidSchema,
  email: z.string().email().optional(),
  username: z.string().optional(),
  created_at: timestampSchema,
  updated_at: timestampSchema.optional(),
})

export type User = z.infer<typeof userSchema>

// ============================================================================
// USER PROFILE SCHEMA
// ============================================================================

export const userProfileSchema = z.object({
  id: uuidSchema,
  email: z.string().email().optional(),
  username: z.string().min(3).max(50).optional(),
  display_name: z.string().max(100).optional(),
  avatar_url: z.string().url().optional(),
  bio: z.string().max(500).optional(),
  created_at: timestampSchema,
  updated_at: timestampSchema.optional(),
})

export type UserProfile = z.infer<typeof userProfileSchema>

// ============================================================================
// VIDEO & IMAGE SCHEMAS
// ============================================================================

export const videoItemSchema = z.object({
  id: uuidSchema,
  url: z.string().url(),
  title: z.string().optional(),
  description: z.string().optional(),
  duration: z.string().optional(),
  thumbnail: z.string().url().optional(),
  platform: z.enum(["youtube", "vimeo", "rumble", "loom", "figma", "google-docs"]).optional(),
  embed_id: z.string().optional(),
  embed_url: z.string().url().optional(),
})

export type VideoItem = z.infer<typeof videoItemSchema>

export const imageItemSchema = z.object({
  id: uuidSchema,
  url: z.string().url(),
  alt: z.string().optional(),
  caption: z.string().optional(),
  size: z.number().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  format: z.string().optional(),
})

export type ImageItem = z.infer<typeof imageItemSchema>

// ============================================================================
// REPLY SCHEMAS
// ============================================================================

export const replySchema = z.object({
  id: uuidSchema,
  note_id: uuidSchema,
  user_id: uuidSchema,
  content: z.string().min(1).max(400),
  color: colorSchema,
  created_at: timestampSchema,
  updated_at: timestampSchema,
  user: userSchema.optional(),
})

export type Reply = z.infer<typeof replySchema>

export const createReplySchema = z.object({
  note_id: uuidSchema,
  content: z.string().min(1, "Reply content is required").max(400, "Reply must be 400 characters or less"),
  color: colorSchema.optional(),
})

export type CreateReplyData = z.infer<typeof createReplySchema>

export const updateReplySchema = z.object({
  content: z.string().min(1).max(400).optional(),
  color: colorSchema.optional(),
})

export type UpdateReplyData = z.infer<typeof updateReplySchema>

// ============================================================================
// NOTE TAB SCHEMAS
// ============================================================================

export const noteTabSchema = z.object({
  id: uuidSchema,
  note_id: uuidSchema,
  tab_type: z.enum(["main", "videos", "images", "details"]),
  tab_data: z
    .object({
      videos: z.array(videoItemSchema).optional(),
      images: z.array(imageItemSchema).optional(),
      content: z.string().optional(),
      metadata: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
      exports: z
        .array(
          z.object({
            url: z.string().url(),
            created_at: timestampSchema,
            type: z.string().optional(),
          }),
        )
        .optional(),
    })
    .optional(),
  videos: z.array(videoItemSchema).optional(),
  images: z.array(imageItemSchema).optional(),
  created_at: timestampSchema,
  updated_at: timestampSchema,
})

export type NoteTab = z.infer<typeof noteTabSchema>

export const createNoteTabSchema = z.object({
  note_id: uuidSchema,
  tab_type: z.enum(["main", "videos", "images", "details"]),
  content: z.string().optional(),
  videos: z.array(videoItemSchema).optional(),
  images: z.array(imageItemSchema).optional(),
  metadata: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
})

export type CreateNoteTabData = z.infer<typeof createNoteTabSchema>

export const updateNoteTabSchema = z.object({
  content: z.string().optional(),
  videos: z.array(videoItemSchema).optional(),
  images: z.array(imageItemSchema).optional(),
  metadata: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
})

export type UpdateNoteTabData = z.infer<typeof updateNoteTabSchema>

// ============================================================================
// TAG SCHEMAS
// ============================================================================

export const tagSchema = z.object({
  id: uuidSchema,
  note_id: uuidSchema,
  user_id: uuidSchema,
  tag_title: z.string().min(1).max(100),
  tag_content: z.string().min(1).max(1000),
  tag_order: z.number().int().min(1),
  created_at: timestampSchema,
  updated_at: timestampSchema,
})

export type Tag = z.infer<typeof tagSchema>

// ============================================================================
// NOTE SCHEMAS
// ============================================================================

export const noteSchema = z.object({
  id: uuidSchema,
  user_id: uuidSchema,
  title: z.string(),
  topic: z.string().max(75).optional(),
  content: z.string().min(1).max(1000),
  details: z.string().optional(),
  color: colorSchema,
  position_x: z.number().int().min(0),
  position_y: z.number().int().min(0),
  is_shared: z.boolean(),
  tags: z.array(z.string()).optional(),
  videos: z.array(videoItemSchema).optional(),
  images: z.array(imageItemSchema).optional(),
  tabs: z.array(noteTabSchema).optional(),
  replies: z.array(replySchema).optional(),
  created_at: timestampSchema,
  updated_at: timestampSchema,
  z_index: z.number().int().optional(),
  hyperlinks: z.array(z.object({ url: z.string().url(), title: z.string().optional() })).optional(),
  is_pinned: z.boolean().optional(),
})

export type Note = z.infer<typeof noteSchema>

export const createNoteSchema = z.object({
  title: z.string().optional().default("Untitled Note"),
  topic: z.string().max(75, "Topic must be 75 characters or less").optional(),
  content: z.string().min(1, "Content is required").max(1000, "Content must be 1000 characters or less"),
  color: colorSchema.optional(),
  position_x: z.number().int().min(0).max(10000).optional().default(0),
  position_y: z.number().int().min(0).max(10000).optional().default(0),
  is_shared: z.boolean().optional().default(false),
  z_index: z.number().int().optional().default(1),
  is_pinned: z.boolean().optional().default(false),
  tags: z.array(z.string()).optional(),
  videos: z.array(videoItemSchema).optional(),
  images: z.array(imageItemSchema).optional(),
})

export type CreateNoteData = z.infer<typeof createNoteSchema>

export const updateNoteSchema = z.object({
  id: uuidSchema,
  title: z.string().optional(),
  topic: z.string().max(75, "Topic must be 75 characters or less").optional(),
  content: z.string().min(1, "Content is required").max(1000, "Content must be 1000 characters or less").optional(),
  color: colorSchema.optional(),
  position_x: z.number().int().min(0).max(10000).optional(),
  position_y: z.number().int().min(0).max(10000).optional(),
  is_shared: z.boolean().optional(),
  z_index: z.number().int().optional(),
  is_pinned: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  videos: z.array(videoItemSchema).optional(),
  images: z.array(imageItemSchema).optional(),
})

export type UpdateNoteData = z.infer<typeof updateNoteSchema>

// ============================================================================
// PAD SCHEMAS
// ============================================================================

export const padSchema = z.object({
  id: uuidSchema,
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  owner_id: uuidSchema,
  created_at: timestampSchema,
  updated_at: timestampSchema,
})

export type Pad = z.infer<typeof padSchema>

export const createPadSchema = z.object({
  name: z.string().min(1, "Pad name is required").max(100, "Pad name must be 100 characters or less"),
  description: z.string().max(500, "Description must be 500 characters or less").optional(),
})

export type CreatePadData = z.infer<typeof createPadSchema>

export const updatePadSchema = z.object({
  id: uuidSchema,
  name: z.string().min(1, "Pad name is required").max(100, "Pad name must be 100 characters or less").optional(),
  description: z.string().max(500, "Description must be 500 characters or less").optional(),
})

export type UpdatePadData = z.infer<typeof updatePadSchema>

// ============================================================================
// STICK TAB SCHEMAS
// ============================================================================

export const stickTabSchema = z.object({
  id: uuidSchema,
  stick_id: uuidSchema,
  tab_type: z.string(),
  tab_data: z.record(z.any()),
  created_at: timestampSchema,
  updated_at: timestampSchema,
})

export type StickTab = z.infer<typeof stickTabSchema>

// ============================================================================
// STICK SCHEMAS
// ============================================================================

export const stickSchema = z.object({
  id: uuidSchema,
  pad_id: uuidSchema.nullable(),
  topic: z.string().max(75).optional(),
  content: z.string().min(1).max(1000),
  details: z.string().optional(),
  color: colorSchema.optional(),
  created_at: timestampSchema,
  updated_at: timestampSchema,
  owner_id: uuidSchema,
  is_quickstick: z.boolean().optional(),
  position_x: z.number().int().optional(),
  position_y: z.number().int().optional(),
  is_shared: z.boolean().optional(),
})

export type Stick = z.infer<typeof stickSchema>

export const createStickSchema = z.object({
  pad_id: uuidSchema.nullable(),
  topic: z.string().max(75, "Topic must be 75 characters or less").optional(),
  content: z.string().min(1, "Content is required").max(1000, "Content must be 1000 characters or less"),
  details: z.string().optional(),
  color: colorSchema.optional(),
  is_quickstick: z.boolean().optional().default(false),
  position_x: z.number().int().optional(),
  position_y: z.number().int().optional(),
  is_shared: z.boolean().optional().default(false),
})

export type CreateStickData = z.infer<typeof createStickSchema>

export const updateStickSchema = z.object({
  id: uuidSchema,
  topic: z.string().max(75, "Topic must be 75 characters or less").optional(),
  content: z.string().min(1, "Content is required").max(1000, "Content must be 1000 characters or less").optional(),
  details: z.string().optional(),
  color: colorSchema.optional(),
  position_x: z.number().int().optional(),
  position_y: z.number().int().optional(),
  is_shared: z.boolean().optional(),
})

export type UpdateStickData = z.infer<typeof updateStickSchema>

// ============================================================================
// RATE LIMIT SCHEMA
// ============================================================================

export const rateLimitSchema = z.object({
  identifier: z.string().min(1),
  action: z.string().min(1),
  limit: z.number().int().positive(),
  window: z.number().int().positive(),
  remaining: z.number().int().min(0),
  reset: z.number().int().positive(),
})

export type RateLimit = z.infer<typeof rateLimitSchema>

// ============================================================================
// SEARCH SCHEMA
// ============================================================================

export const searchSchema = z.object({
  query: z.string().min(1).max(200),
  filter: z.enum(["all", "personal", "shared"]).optional().default("all"),
  tags: z.array(z.string()).optional(),
  limit: z.number().int().min(1).max(100).optional().default(50),
  offset: z.number().int().min(0).optional().default(0),
  sort_by: z.enum(["created_at", "updated_at", "title"]).optional().default("updated_at"),
  sort_order: z.enum(["asc", "desc"]).optional().default("desc"),
})

export type SearchQuery = z.infer<typeof searchSchema>

// ============================================================================
// UTILITY TYPE EXPORTS
// ============================================================================

export type NoteColor = (typeof NOTE_COLORS)[number]["value"]

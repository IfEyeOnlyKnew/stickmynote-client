import { z } from "zod"

export const attachmentTypeSchema = z.enum(["pdf", "doc", "docx", "xls", "xlsx", "txt", "zip", "ppt", "pptx", "csv"])

export type AttachmentType = z.infer<typeof attachmentTypeSchema>

export const cloudProviderSchema = z.enum(["local", "google-drive", "onedrive", "dropbox"])

export type CloudProvider = z.infer<typeof cloudProviderSchema>

export const attachmentSchema = z.object({
  id: z.string(),
  name: z.string(),
  url: z.string().url(),
  size: z.number(),
  type: attachmentTypeSchema,
  provider: cloudProviderSchema.default("local"),
  provider_id: z.string().optional(), // ID from cloud provider
  thumbnail_url: z.string().url().optional(),
  uploaded_at: z.string().datetime(),
  uploaded_by: z.string(),
})

export type Attachment = z.infer<typeof attachmentSchema>

export const createAttachmentSchema = z.object({
  calstick_id: z.string(),
  name: z.string().min(1).max(255),
  url: z.string().url(),
  size: z.number().positive(),
  type: attachmentTypeSchema,
  provider: cloudProviderSchema.default("local"),
  provider_id: z.string().optional(),
  thumbnail_url: z.string().url().optional(),
})

export type CreateAttachmentData = z.infer<typeof createAttachmentSchema>

import { z } from "zod"

export const replyValidationSchema = z.object({
  note_id: z.string().uuid("Invalid note ID"),
  content: z.string().min(1, "Reply content is required").max(400, "Reply must be 400 characters or less"),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Color must be a valid hex color")
    .optional()
    .default("#ffffff"),
})

export const replyValidation = replyValidationSchema

export const noteValidation = z.object({
  topic: z.string().max(75, "Topic must be 75 characters or less").optional().default(""),
  content: z.string().min(1, "Content is required").max(1000, "Content must be 1000 characters or less"),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Color must be a valid hex color")
    .optional()
    .default("#fef3c7"),
  position_x: z.number().min(0).optional().default(0),
  position_y: z.number().min(0).optional().default(0),
  is_shared: z.boolean().optional().default(false),
  tags: z.array(z.string()).optional().default([]),
  hyperlinks: z.array(z.string()).optional().default([]),
})

export const validateUUID = (uuid: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return uuidRegex.test(uuid)
}

export const sanitizeHtml = (html: string): string => {
  return html.replace(/<script[^>]*>.*?<\/script>/gi, "").trim()
}

export const validateAndSanitize = (schema: z.ZodSchema, data: any) => {
  try {
    const result = schema.parse(data)
    return { success: true, data: result }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, errors: error.errors }
    }
    return { success: false, errors: [{ message: "Validation failed" }] }
  }
}

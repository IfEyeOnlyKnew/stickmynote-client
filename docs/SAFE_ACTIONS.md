# Safe Actions Pattern

This document describes the safe actions pattern used in the Stick My Note application for creating type-safe, validated, and authenticated API routes.

## Overview

The `createSafeAction` utility provides a consistent way to handle API routes with:

- **Type-safe inputs/outputs** using Zod schemas
- **Automatic authentication** checks
- **Input validation** with detailed error messages
- **Rate limiting** integration
- **Consistent error handling**

## Basic Usage

### 1. Define Your Schemas

First, define your input and output schemas in `types/schemas.ts`:

\`\`\`typescript
import { z } from "zod"

export const createNoteSchema = z.object({
  topic: z.string().max(75).optional(),
  content: z.string().min(1).max(1000),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  is_shared: z.boolean().optional(),
})

export type CreateNoteData = z.infer<typeof createNoteSchema>
\`\`\`

### 2. Create a Safe Action

Use `createSafeAction` to wrap your handler logic:

\`\`\`typescript
import { createSafeAction, success, error } from "@/lib/safe-action"
import { createNoteSchema } from "@/types/schemas"

const createNoteAction = createSafeAction(
  {
    input: createNoteSchema,
    rateLimit: "notes_create", // Optional: rate limit key
  },
  async (input, { user, supabase }) => {
    // Your business logic here
    const { data, error: dbError } = await supabase
      .from("paks_notes")
      .insert({
        ...input,
        user_id: user.id, // user is automatically available
      })
      .select()
      .single()

    if (dbError) {
      return error("Failed to create note", 500)
    }

    return success(data)
  }
)
\`\`\`

### 3. Export as API Route

\`\`\`typescript
export async function POST(request: NextRequest) {
  return createNoteAction(request)
}
\`\`\`

## API Reference

### `createSafeAction(options, handler)`

Creates a type-safe API route handler.

#### Options

\`\`\`typescript
interface SafeActionOptions<TInput, TOutput> {
  /** Zod schema for input validation */
  input?: ZodSchema<TInput>
  
  /** Zod schema for output validation (optional) */
  output?: ZodSchema<TOutput>
  
  /** Rate limit action name (e.g., "notes_create") */
  rateLimit?: string
  
  /** Whether authentication is required (default: true) */
  requireAuth?: boolean
}
\`\`\`

#### Handler Function

\`\`\`typescript
type SafeActionHandler<TInput, TOutput> = (
  input: TInput,
  context: ActionContext
) => Promise<SafeActionResult<TOutput>>

interface ActionContext {
  user: User           // Authenticated user
  supabase: SupabaseClient  // Supabase client
  request: NextRequest      // Original request
}
\`\`\`

#### Return Helpers

\`\`\`typescript
// Success response
return success(data)

// Error response
return error("Error message", statusCode?, details?)
\`\`\`

## Examples

### Create Operation

\`\`\`typescript
const createNoteAction = createSafeAction(
  {
    input: createNoteSchema,
    rateLimit: "notes_create",
  },
  async (input, { user, supabase }) => {
    const { data, error: dbError } = await supabase
      .from("paks_notes")
      .insert({ ...input, user_id: user.id })
      .select()
      .single()

    if (dbError) {
      return error("Failed to create note", 500)
    }

    return success(data)
  }
)

export async function POST(request: NextRequest) {
  return createNoteAction(request)
}
\`\`\`

### Update Operation

\`\`\`typescript
const updateNoteAction = createSafeAction(
  {
    input: updateNoteSchema,
    rateLimit: "notes_update",
  },
  async (input, { user, supabase }) => {
    const { id, ...updateData } = input

    const { data, error: dbError } = await supabase
      .from("paks_notes")
      .update(updateData)
      .eq("id", id)
      .eq("user_id", user.id) // Ensure user owns the resource
      .select()
      .single()

    if (dbError) {
      return error("Failed to update note", 500)
    }

    if (!data) {
      return error("Note not found", 404)
    }

    return success(data)
  }
)

export async function PUT(request: NextRequest) {
  return updateNoteAction(request)
}
\`\`\`

### Delete Operation

\`\`\`typescript
const deleteNoteAction = createSafeAction(
  {
    input: z.object({ id: uuidSchema }),
    rateLimit: "notes_delete",
  },
  async (input, { user, supabase }) => {
    const { error: dbError } = await supabase
      .from("paks_notes")
      .delete()
      .eq("id", input.id)
      .eq("user_id", user.id)

    if (dbError) {
      return error("Failed to delete note", 500)
    }

    return success({ deleted: true })
  }
)

export async function DELETE(request: NextRequest) {
  return deleteNoteAction(request)
}
\`\`\`

### Public Endpoint (No Auth Required)

\`\`\`typescript
const publicAction = createSafeAction(
  {
    input: z.object({ query: z.string() }),
    requireAuth: false, // Disable auth requirement
  },
  async (input, { supabase }) => {
    // Handle public request
    return success({ result: "public data" })
  }
)
\`\`\`

### Permission Checks

\`\`\`typescript
const updatePadAction = createSafeAction(
  {
    input: updatePadSchema,
    rateLimit: "pads_update",
  },
  async (input, { user, supabase }) => {
    const { id, ...updateData } = input

    // Check if user owns the pad
    const { data: pad } = await supabase
      .from("paks_pads")
      .select("owner_id")
      .eq("id", id)
      .single()

    if (!pad) {
      return error("Pad not found", 404)
    }

    if (pad.owner_id !== user.id) {
      return error("Insufficient permissions", 403)
    }

    // Proceed with update
    const { data, error: dbError } = await supabase
      .from("paks_pads")
      .update(updateData)
      .eq("id", id)
      .select()
      .single()

    if (dbError) {
      return error("Failed to update pad", 500)
    }

    return success(data)
  }
)
\`\`\`

## Benefits

1. **Type Safety**: Input and output types are inferred from Zod schemas
2. **Validation**: Automatic input validation with detailed error messages
3. **Authentication**: Consistent auth checks across all routes
4. **Rate Limiting**: Easy integration with rate limiting
5. **Error Handling**: Consistent error response format
6. **DRY**: Eliminates boilerplate code in API routes
7. **Testability**: Handler functions are pure and easy to test

## Migration Guide

### Before (Manual Validation)

\`\`\`typescript
export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServer()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const validation = validateAndSanitize(noteValidation, body)
    
    if (!validation.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 })
    }

    // Business logic...
    
  } catch (error) {
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
\`\`\`

### After (Safe Action)

\`\`\`typescript
const createNoteAction = createSafeAction(
  { input: createNoteSchema, rateLimit: "notes_create" },
  async (input, { user, supabase }) => {
    // Business logic only
    const { data, error } = await supabase
      .from("paks_notes")
      .insert({ ...input, user_id: user.id })
      .select()
      .single()

    if (error) return error("Failed to create note", 500)
    return success(data)
  }
)

export async function POST(request: NextRequest) {
  return createNoteAction(request)
}
\`\`\`

## Best Practices

1. **Define schemas in `types/schemas.ts`** for reusability
2. **Use descriptive rate limit keys** (e.g., "notes_create", "pads_update")
3. **Always check permissions** before modifying resources
4. **Return appropriate status codes** (404 for not found, 403 for forbidden, etc.)
5. **Use the `success()` and `error()` helpers** for consistent responses
6. **Keep handler functions focused** on business logic only
7. **Add JSDoc comments** to document complex handlers

## Error Handling

The safe action wrapper automatically handles:

- Authentication errors (401)
- Validation errors (400)
- Rate limit errors (429)
- Unexpected errors (500)

Your handler should return:

\`\`\`typescript
// Success
return success(data)

// Error with custom status
return error("Resource not found", 404)

// Error with details
return error("Validation failed", 400, { field: "email", issue: "invalid" })
\`\`\`

## Testing

Safe actions are easy to test because the handler is a pure function:

\`\`\`typescript
import { describe, it, expect, vi } from "vitest"

describe("createNoteAction", () => {
  it("should create a note", async () => {
    const mockSupabase = {
      from: vi.fn(() => ({
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => ({ data: mockNote, error: null }))
          }))
        }))
      }))
    }

    const result = await handler(
      { content: "Test", topic: "Test" },
      { user: mockUser, supabase: mockSupabase, request: mockRequest }
    )

    expect(result.success).toBe(true)
    expect(result.data).toEqual(mockNote)
  })
})

import { type NextRequest, NextResponse } from "next/server"
import type { ZodSchema } from "zod"
import { createSupabaseServer } from "@/lib/supabase-server"
import { applyRateLimit } from "@/lib/rate-limiter-enhanced"
import { validateCSRFMiddleware } from "@/lib/csrf"
import type { User } from "@supabase/supabase-js"
import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * Context provided to action handlers
 */
export interface ActionContext {
  user: User
  supabase: SupabaseClient
  request: NextRequest
}

/**
 * Options for creating a safe action
 */
export interface SafeActionOptions<TInput, TOutput> {
  /** Zod schema for input validation */
  input?: ZodSchema<TInput>
  /** Zod schema for output validation (optional, for type safety) */
  output?: ZodSchema<TOutput>
  /** Rate limit action name (e.g., "notes_create") */
  rateLimit?: string
  /** Whether authentication is required (default: true) */
  requireAuth?: boolean
}

/**
 * Result type for safe actions
 */
export type SafeActionResult<TOutput> =
  | { success: true; data: TOutput }
  | { success: false; error: string; status?: number; details?: unknown }

/**
 * Handler function type
 */
export type SafeActionHandler<TInput, TOutput> = (
  input: TInput,
  context: ActionContext,
) => Promise<SafeActionResult<TOutput>>

/**
 * Creates a type-safe, validated, and authenticated API route handler
 *
 * @example
 * \`\`\`typescript
 * const createNoteAction = createSafeAction({
 *   input: createNoteSchema,
 *   rateLimit: "notes_create",
 * }, async (input, { user, supabase }) => {
 *   const { data, error } = await supabase
 *     .from("notes")
 *     .insert({ ...input, user_id: user.id })
 *     .select()
 *     .single()
 *
 *   if (error) {
 *     return { success: false, error: "Failed to create note", status: 500 }
 *   }
 *
 *   return { success: true, data }
 * })
 *
 * export async function POST(request: NextRequest) {
 *   return createNoteAction(request)
 * }
 * \`\`\`
 */
export function createSafeAction<TInput = unknown, TOutput = unknown>(
  options: SafeActionOptions<TInput, TOutput>,
  handler: SafeActionHandler<TInput, TOutput>,
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    try {
      const isCSRFValid = await validateCSRFMiddleware(request)
      if (!isCSRFValid) {
        return NextResponse.json({ error: "Invalid or missing CSRF token" }, { status: 403 })
      }

      // 2. Authentication check
      const supabase = await createSupabaseServer()
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()

      const requireAuth = options.requireAuth !== false

      if (requireAuth && (authError || !user)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }

      // 3. Rate limiting (if configured)
      if (options.rateLimit && user) {
        try {
          const rateLimitResult = await applyRateLimit(request, user.id, options.rateLimit)
          if (!rateLimitResult.success) {
            return NextResponse.json(
              { error: "Rate limit exceeded" },
              { status: 429, headers: { "Retry-After": "60" } },
            )
          }
        } catch (err) {
          console.warn("Rate limit provider error, allowing request:", err)
        }
      }

      // 4. Input validation (if schema provided)
      let validatedInput: TInput
      if (options.input) {
        try {
          const body = await request.json()
          const result = options.input.safeParse(body)

          if (!result.success) {
            return NextResponse.json(
              {
                error: "Invalid input",
                details: result.error.flatten().fieldErrors,
              },
              { status: 400 },
            )
          }

          validatedInput = result.data
        } catch (err) {
          return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
        }
      } else {
        // No input validation, pass empty object
        validatedInput = {} as TInput
      }

      // 5. Execute handler
      const context: ActionContext = {
        user: user!,
        supabase,
        request,
      }

      const result = await handler(validatedInput, context)

      // 6. Handle result
      if (!result.success) {
        return NextResponse.json({ error: result.error, details: result.details }, { status: result.status || 500 })
      }

      // 7. Output validation (optional, for type safety)
      if (options.output) {
        const outputResult = options.output.safeParse(result.data)
        if (!outputResult.success) {
          console.error("Output validation failed:", outputResult.error)
          return NextResponse.json({ error: "Internal server error" }, { status: 500 })
        }
      }

      return NextResponse.json(result.data)
    } catch (error) {
      console.error("Safe action error:", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  }
}

/**
 * Helper to create a success result
 */
export function success<T>(data: T): SafeActionResult<T> {
  return { success: true, data }
}

/**
 * Helper to create an error result
 */
export function error(message: string, status?: number, details?: unknown): SafeActionResult<never> {
  return { success: false, error: message, status, details }
}

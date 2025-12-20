import { type NextRequest, NextResponse } from "next/server"
import type { ZodSchema } from "zod"
import { applyRateLimit } from "@/lib/rate-limiter-enhanced"
import { validateCSRFMiddleware } from "@/lib/csrf"
import { getSession } from "@/lib/auth/local-auth"
import { createDatabaseClient, type DatabaseClient } from "@/lib/database/database-adapter"

// ============================================================================
// Types
// ============================================================================

interface SessionUser {
  id: string
  email?: string
  [key: string]: unknown
}

export interface ActionContext {
  user: SessionUser | null
  db: DatabaseClient
  request: NextRequest
}

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

export type SafeActionResult<TOutput> =
  | { success: true; data: TOutput }
  | { success: false; error: string; status?: number; details?: unknown }

export type SafeActionHandler<TInput, TOutput> = (
  input: TInput,
  context: ActionContext,
) => Promise<SafeActionResult<TOutput>>

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_ERROR_STATUS = 500
const RATE_LIMIT_RETRY_SECONDS = "60"

const ErrorMessages = {
  CSRF_INVALID: "Invalid or missing CSRF token",
  UNAUTHORIZED: "Unauthorized",
  RATE_LIMITED: "Rate limit exceeded",
  INVALID_JSON: "Invalid JSON body",
  INVALID_INPUT: "Invalid input",
  INTERNAL: "Internal server error",
} as const

const StatusCodes = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_ERROR: 500,
} as const

// ============================================================================
// Response Helpers
// ============================================================================

function jsonResponse<T>(data: T, status = 200, headers?: Record<string, string>): NextResponse {
  return NextResponse.json(data, { status, headers })
}

function errorResponse(
  message: string,
  status: number,
  details?: unknown,
  headers?: Record<string, string>,
): NextResponse {
  const body = details ? { error: message, details } : { error: message }
  return jsonResponse(body, status, headers)
}

const Errors = {
  csrf: () => errorResponse(ErrorMessages.CSRF_INVALID, StatusCodes.FORBIDDEN),
  unauthorized: () => errorResponse(ErrorMessages.UNAUTHORIZED, StatusCodes.UNAUTHORIZED),
  rateLimited: () => errorResponse(
    ErrorMessages.RATE_LIMITED,
    StatusCodes.TOO_MANY_REQUESTS,
    undefined,
    { "Retry-After": RATE_LIMIT_RETRY_SECONDS }
  ),
  invalidJson: () => errorResponse(ErrorMessages.INVALID_JSON, StatusCodes.BAD_REQUEST),
  validation: (fieldErrors: Record<string, string[] | undefined>) =>
    errorResponse(ErrorMessages.INVALID_INPUT, StatusCodes.BAD_REQUEST, fieldErrors),
  internal: () => errorResponse(ErrorMessages.INTERNAL, StatusCodes.INTERNAL_ERROR),
  custom: (message: string, status = DEFAULT_ERROR_STATUS, details?: unknown) =>
    errorResponse(message, status, details),
} as const

// ============================================================================
// Validation Helpers
// ============================================================================

interface ValidationSuccess<T> {
  valid: true
  data: T
}

interface ValidationFailure {
  valid: false
  response: NextResponse
}

type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure

async function parseAndValidateInput<TInput>(
  request: NextRequest,
  schema: ZodSchema<TInput>,
): Promise<ValidationResult<TInput>> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return { valid: false, response: Errors.invalidJson() }
  }

  const result = schema.safeParse(body)
  if (!result.success) {
    return { valid: false, response: Errors.validation(result.error.flatten().fieldErrors) }
  }

  return { valid: true, data: result.data }
}

function validateOutput<TOutput>(data: unknown, schema: ZodSchema<TOutput>): boolean {
  const result = schema.safeParse(data)
  if (!result.success) {
    console.error("[SafeAction] Output validation failed:", result.error)
    return false
  }
  return true
}

// ============================================================================
// Middleware Helpers
// ============================================================================

async function checkRateLimit(request: NextRequest, userId: string, actionName: string): Promise<boolean> {
  try {
    const result = await applyRateLimit(request, userId, actionName)
    return result.success
  } catch (err) {
    console.warn("[SafeAction] Rate limit provider error, allowing request:", err)
    return true
  }
}

async function getAuthContext(): Promise<{ user: SessionUser | null; db: DatabaseClient }> {
  const session = await getSession()
  const user = session?.user ? (session.user as unknown as SessionUser) : null
  const db = await createDatabaseClient()
  return { user, db }
}

// ============================================================================
// Main Factory
// ============================================================================

/**
 * Creates a type-safe, validated, and authenticated API route handler
 *
 * @example
 * ```typescript
 * const createNoteAction = createSafeAction({
 *   input: createNoteSchema,
 *   rateLimit: "notes_create",
 * }, async (input, { user, db }) => {
 *   const { data, error } = await db
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
 * ```
 */
export function createSafeAction<TInput = unknown, TOutput = unknown>(
  options: SafeActionOptions<TInput, TOutput>,
  handler: SafeActionHandler<TInput, TOutput>,
): (request: NextRequest) => Promise<NextResponse> {
  const { input: inputSchema, output: outputSchema, rateLimit, requireAuth = true } = options

  return async (request: NextRequest): Promise<NextResponse> => {
    try {
      // 1. CSRF validation
      const isCSRFValid = await validateCSRFMiddleware(request)
      if (!isCSRFValid) {
        return Errors.csrf()
      }

      // 2. Authentication check
      const { user, db } = await getAuthContext()
      if (requireAuth && !user) {
        return Errors.unauthorized()
      }

      // 3. Rate limiting (only for authenticated users)
      if (rateLimit && user) {
        const allowed = await checkRateLimit(request, user.id, rateLimit)
        if (!allowed) {
          return Errors.rateLimited()
        }
      }

      // 4. Input validation
      let validatedInput: TInput
      if (inputSchema) {
        const validation = await parseAndValidateInput(request, inputSchema)
        if (!validation.valid) {
          return validation.response
        }
        validatedInput = validation.data
      } else {
        validatedInput = {} as TInput
      }

      // 5. Execute handler
      const context: ActionContext = { user, db, request }
      const result = await handler(validatedInput, context)

      // 6. Handle error result
      if (!result.success) {
        return Errors.custom(result.error, result.status, result.details)
      }

      // 7. Output validation (optional)
      if (outputSchema && !validateOutput(result.data, outputSchema)) {
        return Errors.internal()
      }

      return jsonResponse(result.data)
    } catch (error) {
      console.error("[SafeAction] Unhandled error:", error)
      return Errors.internal()
    }
  }
}

// ============================================================================
// Result Helpers
// ============================================================================

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

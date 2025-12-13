import type { User } from "@supabase/supabase-js"

let Sentry: any = null
if (process.env.NODE_ENV === "production") {
  import("@sentry/nextjs")
    .then((module) => {
      Sentry = module
    })
    .catch(() => {
      // Sentry not available
    })
}

/**
 * Set user context for Sentry error tracking
 */
export function setSentryUser(user: User | null) {
  if (!Sentry) return

  if (user) {
    Sentry.setUser({
      id: user.id,
      email: user.email,
      username: user.user_metadata?.username,
    })
  } else {
    Sentry.setUser(null)
  }
}

/**
 * Add breadcrumb for tracking user actions
 */
export function addSentryBreadcrumb(
  message: string,
  category: string,
  level: "info" | "warning" | "error" = "info",
  data?: Record<string, unknown>,
) {
  if (!Sentry) return

  Sentry.addBreadcrumb({
    message,
    category,
    level,
    data,
    timestamp: Date.now() / 1000,
  })
}

/**
 * Capture exception with additional context
 */
export function captureException(
  error: Error,
  context?: {
    tags?: Record<string, string>
    extra?: Record<string, unknown>
    level?: "fatal" | "error" | "warning" | "info" | "debug"
  },
) {
  if (!Sentry) {
    console.error("Exception:", error, context)
    return
  }

  Sentry.captureException(error, {
    tags: context?.tags,
    extra: context?.extra,
    level: context?.level,
  })
}

/**
 * Capture message with context
 */
export function captureMessage(
  message: string,
  level: "fatal" | "error" | "warning" | "info" | "debug" = "info",
  context?: {
    tags?: Record<string, string>
    extra?: Record<string, unknown>
  },
) {
  if (!Sentry) {
    console.log(`[${level}] ${message}`, context)
    return
  }

  Sentry.captureMessage(message, {
    level,
    tags: context?.tags,
    extra: context?.extra,
  })
}

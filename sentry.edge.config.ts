const shouldInitializeSentry =
  process.env.NODE_ENV === "production" && process.env.SENTRY_DSN && process.env.SENTRY_AUTH_TOKEN

if (shouldInitializeSentry) {
  import("@sentry/nextjs").then((Sentry) => {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,

      // Environment and release tracking
      environment: process.env.NODE_ENV || "development",
      release: process.env.VERCEL_GIT_COMMIT_SHA || "development",

      // Performance monitoring - lower sample rate for edge functions
      tracesSampleRate: 0.05,

      // Debug mode only in development
      debug: false,

      // Filter out known errors
      ignoreErrors: [
        // Network errors
        "ECONNREFUSED",
        "ETIMEDOUT",
        // Auth errors (handled by app)
        "Invalid login credentials",
        "Email not confirmed",
        // Next.js internal errors
        "NEXT_REDIRECT",
        "NEXT_NOT_FOUND",
      ],

      // Enhanced error filtering for edge runtime
      beforeSend(event, hint) {
        const error = hint?.originalException
        if (error && typeof error === "object") {
          // Check for Next.js redirect digest
          if ("digest" in error && typeof error.digest === "string") {
            if (error.digest.startsWith("NEXT_REDIRECT") || error.digest.startsWith("NEXT_NOT_FOUND")) {
              return null
            }
          }
        }

        // Add edge runtime context
        event.contexts = {
          ...event.contexts,
          runtime: {
            name: "edge",
          },
        }

        // Filter out middleware health checks
        if (event.request?.url?.includes("/api/health")) {
          return null
        }

        return event
      },
    })
  })
}

// Export empty object to make this a valid module
export {}

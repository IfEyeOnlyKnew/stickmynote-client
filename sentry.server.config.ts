const shouldInitializeSentry =
  process.env.NODE_ENV === "production" && process.env.SENTRY_DSN && process.env.SENTRY_AUTH_TOKEN

if (shouldInitializeSentry) {
  import("@sentry/nextjs").then((Sentry) => {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,

      // Environment and release tracking
      environment: process.env.NODE_ENV || "development",
      release: process.env.VERCEL_GIT_COMMIT_SHA || "development",

      // Performance monitoring
      tracesSampleRate: 0.1,

      // Profiling for performance insights
      profilesSampleRate: 0.1,

      // Debug mode only in development
      debug: false,

      // Server-side integrations
      integrations: [Sentry.prismaIntegration(), Sentry.postgresIntegration(), Sentry.httpIntegration()],

      // Filter out known errors
      ignoreErrors: [
        // Database connection errors (handled by app)
        "ECONNREFUSED",
        "ETIMEDOUT",
        "ENOTFOUND",
        // Supabase auth errors (handled by app)
        "Invalid login credentials",
        "Email not confirmed",
        "User already registered",
        // Expected API errors
        "CSRF token validation failed",
        "Rate limit exceeded",
        // Next.js internal errors that should not be logged
        "NEXT_REDIRECT",
        "NEXT_NOT_FOUND",
      ],

      // Enhanced error filtering
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

        // Add server context
        event.contexts = {
          ...event.contexts,
          runtime: {
            name: "node",
            version: process.version,
          },
        }

        // Filter out health check errors
        if (event.request?.url?.includes("/api/health")) {
          return null
        }

        // Sanitize sensitive data from request
        if (event.request) {
          // Remove sensitive headers
          if (event.request.headers) {
            delete event.request.headers["authorization"]
            delete event.request.headers["cookie"]
            delete event.request.headers["x-csrf-token"]
          }

          // Remove sensitive query parameters
          if (event.request.query_string) {
            const params = new URLSearchParams(event.request.query_string)
            params.delete("token")
            params.delete("key")
            params.delete("secret")
            params.delete("password")
            event.request.query_string = params.toString()
          }
        }

        return event
      },

      // Breadcrumb filtering
      beforeBreadcrumb(breadcrumb, hint) {
        // Filter out database query breadcrumbs in production (too verbose)
        if (breadcrumb.category === "query") {
          return null
        }

        return breadcrumb
      },
    })
  })
}

// Export empty object to make this a valid module
export {}

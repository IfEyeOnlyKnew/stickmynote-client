const shouldInitializeSentry =
  process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_SENTRY_DSN && typeof window !== "undefined"

if (shouldInitializeSentry) {
  import("@sentry/nextjs").then((Sentry) => {
    // @ts-ignore
    if (!global.__sentryInitialized) {
      // @ts-ignore
      global.__sentryInitialized = true

      Sentry.init({
        dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

        // Environment and release tracking
        environment: process.env.NODE_ENV || "development",
        release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || "development",

        // Performance monitoring - lower sample rate in production to reduce costs
        tracesSampleRate: 0.1,

        // Session replay configuration
        replaysOnErrorSampleRate: 1.0, // Capture 100% of sessions with errors
        replaysSessionSampleRate: 0.1,

        // Debug mode only in development
        debug: false,

        // Integrations
        integrations: [
          Sentry.replayIntegration({
            maskAllText: true,
            blockAllMedia: true,
            maskAllInputs: true,
          }),
          Sentry.browserTracingIntegration(),
          Sentry.browserProfilingIntegration(),
        ],

        // Filter out known errors and noise
        ignoreErrors: [
          // Browser extensions
          "top.GLOBALS",
          "chrome-extension://",
          "moz-extension://",
          // Network errors that are expected
          "NetworkError",
          "Failed to fetch",
          "Load failed",
          "Network request failed",
          // Supabase auth errors (handled by app)
          "Invalid login credentials",
          "Email not confirmed",
          "User already registered",
          // Aborted requests (user navigation)
          "AbortError",
          "The operation was aborted",
          // ResizeObserver errors (benign)
          "ResizeObserver loop limit exceeded",
          "ResizeObserver loop completed with undelivered notifications",
          // Next.js internal errors
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

          // Filter out errors from browser extensions
          if (
            event.exception?.values?.[0]?.stacktrace?.frames?.some(
              (frame) =>
                frame.filename?.includes("chrome-extension://") ||
                frame.filename?.includes("moz-extension://") ||
                frame.filename?.includes("safari-extension://"),
            )
          ) {
            return null
          }

          // Filter out localhost errors in production
          if (event.request?.url?.includes("localhost")) {
            return null
          }

          // Add user context if available (without PII)
          if (typeof window !== "undefined" && window.localStorage) {
            const userId = window.localStorage.getItem("userId")
            if (userId) {
              event.user = { id: userId }
            }
          }

          return event
        },

        // Breadcrumb filtering
        beforeBreadcrumb(breadcrumb, hint) {
          // Filter out noisy console logs
          if (breadcrumb.category === "console" && breadcrumb.level === "log") {
            return null
          }

          // Sanitize URLs to remove sensitive query parameters
          if (breadcrumb.data?.url) {
            try {
              const url = new URL(breadcrumb.data.url)
              url.searchParams.delete("token")
              url.searchParams.delete("key")
              url.searchParams.delete("secret")
              breadcrumb.data.url = url.toString()
            } catch {
              // Invalid URL, keep as is
            }
          }

          return breadcrumb
        },
      })
    }
  })
}

// Export no-op function if Sentry is not initialized
export const onRouterTransitionStart = () => {}

declare global {
  var __sentryInitialized: boolean | undefined
}

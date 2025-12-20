// Client-side instrumentation
// Sentry has been removed - errors are logged to console
// For production error tracking, consider logging to your database

if (typeof window !== "undefined") {
  // Log unhandled errors to console
  window.addEventListener("error", (event) => {
    console.error("[Global Error]", event.error)
  })

  // Log unhandled promise rejections
  window.addEventListener("unhandledrejection", (event) => {
    console.error("[Unhandled Rejection]", event.reason)
  })
}

// Export no-op function for compatibility
export const onRouterTransitionStart = () => {}

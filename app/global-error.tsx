"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    const logError = async () => {
      if (process.env.NODE_ENV === "production") {
        try {
          const Sentry = await import("@sentry/nextjs")
          Sentry.captureException(error)
        } catch (err) {
          console.error("Failed to load Sentry:", err)
          console.error("Global error:", error)
        }
      } else {
        console.error("Global error:", error)
      }
    }

    logError()
  }, [error])

  return (
    <html lang="en">
      <body>
        <div className="flex min-h-screen items-center justify-center bg-background p-4">
          <div className="max-w-md space-y-4 text-center">
            <h2 className="text-2xl font-bold text-foreground">Something went wrong!</h2>
            <p className="text-muted-foreground">
              An unexpected error occurred. Our team has been notified and is working on a fix.
            </p>
            {error.digest && (
              <p className="text-sm text-muted-foreground">
                Error ID: <code className="rounded bg-muted px-1 py-0.5">{error.digest}</code>
              </p>
            )}
            <div className="flex gap-2 justify-center">
              <Button onClick={() => reset()}>Try again</Button>
              <Button variant="outline" onClick={() => (window.location.href = "/")}>
                Go home
              </Button>
            </div>
          </div>
        </div>
      </body>
    </html>
  )
}

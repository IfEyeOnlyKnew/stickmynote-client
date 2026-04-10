"use client"

import React from "react"
import { Button } from "@/components/ui/button"
import { AlertTriangle } from "lucide-react"
import { isDevelopment } from "@/lib/client-env"

interface ErrorBoundaryProps {
  readonly children: React.ReactNode
  readonly fallback?: React.ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error to console and potentially to error_logs table via API
    console.error("Error caught by ErrorBoundary:", error, errorInfo)
    
    // Try to log to our error_logs API endpoint
    if (globalThis.window !== undefined && process.env.NODE_ENV === "production") {
      try {
        fetch("/api/log-error", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            error_message: error.message,
            error_stack: error.stack,
            component_stack: errorInfo.componentStack,
            error_type: "react_error_boundary",
            url: globalThis.location.href,
          }),
        }).catch(() => {
          // Silently fail if error logging fails
        })
      } catch {
        // Silently fail
      }
    }
  }

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback
      }

      // Default error UI
      return (
        <div className="flex min-h-screen items-center justify-center p-4">
          <div className="w-full max-w-md space-y-4 text-center">
            <div className="flex justify-center">
              <AlertTriangle className="h-12 w-12 text-destructive" />
            </div>
            <h1 className="text-2xl font-bold">Something went wrong</h1>
            <p className="text-muted-foreground">We&apos;ve been notified and are working to fix the issue.</p>
            <div className="flex gap-2 justify-center">
              <Button
                onClick={() => {
                  this.setState({ hasError: false, error: null })
                }}
              >
                Try again
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  globalThis.location.href = "/"
                }}
              >
                Go home
              </Button>
            </div>
            {isDevelopment && this.state.error && (
              <details className="mt-4 text-left">
                <summary className="cursor-pointer text-sm font-medium">Error details (dev only)</summary>
                <pre className="mt-2 overflow-auto rounded bg-muted p-4 text-xs">
                  {this.state.error.toString()}
                  {"\n\n"}
                  {this.state.error.stack}
                </pre>
              </details>
            )}
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

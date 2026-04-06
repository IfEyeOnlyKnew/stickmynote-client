"use client"

import { WifiOff } from "lucide-react"

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/20 mb-6">
        <WifiOff className="h-10 w-10 text-amber-600 dark:text-amber-400" />
      </div>
      <h1 className="text-2xl font-bold mb-2">You&apos;re Offline</h1>
      <p className="text-muted-foreground max-w-md mb-6">
        It looks like you&apos;ve lost your internet connection. Some features are
        available offline, but you&apos;ll need to reconnect for full functionality.
      </p>
      <div className="space-y-3 text-sm text-muted-foreground">
        <p>Things you can do offline:</p>
        <ul className="list-disc list-inside space-y-1 text-left">
          <li>View previously cached pages</li>
          <li>Read cached notes and content</li>
          <li>Draft new content (syncs when online)</li>
        </ul>
      </div>
      <button
        type="button"
        onClick={() => globalThis.location.reload()}
        className="mt-8 rounded-lg bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        Try Again
      </button>
    </div>
  )
}

"use client"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { AlertTriangle, X } from "lucide-react"

interface DuplicateCheckAlertProps {
  isDuplicate: boolean
  similarity?: number
  similarToId?: string
  onDismiss: () => void
  onViewSimilar?: () => void
}

export function DuplicateCheckAlert({
  isDuplicate,
  similarity,
  similarToId,
  onDismiss,
  onViewSimilar,
}: Readonly<DuplicateCheckAlertProps>) {
  if (!isDuplicate) return null

  return (
    <Alert variant="destructive" className="relative">
      <AlertTriangle className="h-4 w-4" />
      <Button variant="ghost" size="sm" className="absolute top-2 right-2 h-6 w-6 p-0" onClick={onDismiss}>
        <X className="h-4 w-4" />
      </Button>
      <AlertTitle>Possible Duplicate Detected</AlertTitle>
      <AlertDescription className="space-y-2">
        <p>This content appears to be {similarity}% similar to an existing stick in this pad.</p>
        {onViewSimilar && similarToId && (
          <Button variant="outline" size="sm" onClick={onViewSimilar}>
            View Similar Stick
          </Button>
        )}
      </AlertDescription>
    </Alert>
  )
}

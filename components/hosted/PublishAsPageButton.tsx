"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Globe } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface PublishAsPageButtonProps {
  readonly stickId: string
  readonly kind: "personal" | "pad" | "concur"
  readonly canPublish: boolean
  readonly size?: "sm" | "default"
  readonly className?: string
}

export function PublishAsPageButton({
  stickId,
  kind,
  canPublish,
  size = "sm",
  className,
}: PublishAsPageButtonProps) {
  const [isPublishing, setIsPublishing] = useState(false)
  const [publishedSlug, setPublishedSlug] = useState<string | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    if (!stickId) return
    let cancelled = false
    fetch(`/api/sticks/${stickId}/hosted-page`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data?.exists) setPublishedSlug(data.slug)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [stickId])

  const handlePublish = async () => {
    setIsPublishing(true)
    toast({
      title: "Publishing page...",
      description: "Ollama is writing the article. This can take 15-30 seconds.",
    })
    try {
      const res = await fetch(`/api/sticks/${stickId}/hosted-page?kind=${kind}`, { method: "POST" })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: data.error || "Failed to publish page", variant: "destructive" })
        return
      }
      await navigator.clipboard.writeText(data.url).catch(() => {})
      setPublishedSlug(data.slug)
      toast({ title: "Page published", description: "Opened in new tab. URL copied." })
      window.open(data.url, "_blank", "noopener")
    } catch {
      toast({ title: "Failed to publish page", variant: "destructive" })
    } finally {
      setIsPublishing(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      {canPublish && (
        <Button
          variant="outline"
          size={size}
          className={className}
          disabled={isPublishing}
          onClick={handlePublish}
        >
          {isPublishing ? (
            <>
              <div className="h-3 w-3 mr-1 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
              Publishing...
            </>
          ) : (
            <>
              <Globe className="h-3 w-3 mr-1" />
              {publishedSlug ? "Republish as Page" : "Publish as Page"}
            </>
          )}
        </Button>
      )}

      {publishedSlug && !isPublishing && (
        <Button
          variant="outline"
          size={size}
          className={className}
          onClick={() => window.open(`/hosted/${publishedSlug}`, "_blank", "noopener")}
        >
          <Globe className="h-3 w-3 mr-1" />
          View Published Page
        </Button>
      )}
    </div>
  )
}

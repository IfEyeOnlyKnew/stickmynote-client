"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Lightbulb, Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"

interface RelatedStick {
  id: string
  topic: string
  content: string
  color: string
  created_at: string
}

interface RelatedSticksSidebarProps {
  stickId: string
}

export function RelatedSticksSidebar({ stickId }: RelatedSticksSidebarProps) {
  const router = useRouter()
  const [relatedSticks, setRelatedSticks] = useState<RelatedStick[]>([])
  const [loading, setLoading] = useState(true)

  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    fetchRelatedSticks()
  }, [stickId])
  /* eslint-enable react-hooks/exhaustive-deps */

  const fetchRelatedSticks = async () => {
    try {
      setLoading(true)
      const response = await fetch("/api/search/related", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stickId, limit: 5 }),
      })

      if (response.ok) {
        const data = await response.json()
        setRelatedSticks(data.relatedSticks || [])
      }
    } catch (error) {
      console.error("[v0] Error fetching related sticks:", error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Lightbulb className="h-4 w-4" />
            Related Sticks
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (relatedSticks.length === 0) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-yellow-500" />
          Related Sticks
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {relatedSticks.map((stick) => (
          <div
            key={stick.id}
            role="button"
            tabIndex={0}
            className="p-3 rounded-lg border cursor-pointer hover:bg-accent transition-colors"
            style={{ backgroundColor: stick.color }}
            onClick={() => router.push(`/inference/sticks/${stick.id}`)}
            onKeyDown={(e) => e.key === "Enter" && router.push(`/inference/sticks/${stick.id}`)}
          >
            <h4 className="font-medium text-sm line-clamp-1">{stick.topic}</h4>
            <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{stick.content}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

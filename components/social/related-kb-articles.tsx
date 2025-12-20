"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { BookOpen, ExternalLink, ThumbsUp, Sparkles, ChevronDown, ChevronUp } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"

interface KBArticle {
  id: string
  title: string
  content: string
  category: string
  tags: string[]
  helpful_count: number
  view_count: number
  created_at: string
  author?: {
    full_name: string | null
    email: string
  }
}

interface RelatedKBArticlesProps {
  padId: string
  stickTags?: string[]
  stickContent?: string
  onCiteArticle?: (article: KBArticle) => void
  className?: string
}

export function RelatedKBArticles({
  padId,
  stickTags = [],
  stickContent = "",
  onCiteArticle,
  className,
}: RelatedKBArticlesProps) {
  const [articles, setArticles] = useState<KBArticle[]>([])
  const [loading, setLoading] = useState(false)
  const [isExpanded, setIsExpanded] = useState(true)

  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    if (padId && (stickTags.length > 0 || stickContent)) {
      fetchRelatedArticles()
    }
  }, [padId, stickTags, stickContent])
  /* eslint-enable react-hooks/exhaustive-deps */

  const fetchRelatedArticles = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()

      if (stickTags.length > 0) {
        params.set("tags", stickTags.join(","))
      }

      // Extract keywords from content for broader search
      if (stickContent) {
        const keywords = stickContent
          .split(/\s+/)
          .filter((word) => word.length > 4)
          .slice(0, 5)
          .join(" ")
        if (keywords) {
          params.set("query", keywords)
        }
      }

      const response = await fetch(`/api/social-pads/${padId}/knowledge-base/search?${params}`)
      if (response.ok) {
        const data = await response.json()
        setArticles(data.articles || [])
      }
    } catch (error) {
      console.error("[v0] Error fetching related KB articles:", error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="py-4 flex items-center justify-center">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-600" />
        </CardContent>
      </Card>
    )
  }

  if (articles.length === 0) {
    return null
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-purple-600" />
            Related Knowledge Base Articles
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={() => setIsExpanded(!isExpanded)} className="h-6 w-6 p-0">
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      {isExpanded && (
        <CardContent className="pt-0">
          <ScrollArea className="max-h-[200px]">
            <div className="space-y-2">
              {articles.map((article) => (
                <div key={article.id} className="p-3 border rounded-lg hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <BookOpen className="h-3 w-3 text-purple-600 shrink-0" />
                        <span className="text-sm font-medium truncate">{article.title}</span>
                      </div>
                      <p className="text-xs text-gray-500 line-clamp-2 mb-2">{article.content}</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="secondary" className="text-xs">
                          {article.category}
                        </Badge>
                        {article.tags.slice(0, 2).map((tag) => (
                          <Badge key={tag} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <ThumbsUp className="h-3 w-3" />
                          {article.helpful_count}
                        </span>
                      </div>
                    </div>
                    {onCiteArticle && (
                      <Button variant="ghost" size="sm" onClick={() => onCiteArticle(article)} className="h-7 shrink-0">
                        <ExternalLink className="h-3 w-3 mr-1" />
                        Cite
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      )}
    </Card>
  )
}

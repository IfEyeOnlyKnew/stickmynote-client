"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Lightbulb, Loader2 } from "lucide-react"
import { useAIFeatures } from "@/hooks/use-ai-features"

interface AIReplySuggestionsProps {
  stickContent: string
  stickTopic?: string
  onSelectSuggestion: (suggestion: string) => void
}

export function AIReplySuggestions({ stickContent, stickTopic, onSelectSuggestion }: AIReplySuggestionsProps) {
  const { suggestReplies, isGenerating } = useAIFeatures()
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [isExpanded, setIsExpanded] = useState(false)

  useEffect(() => {
    if (isExpanded && suggestions.length === 0 && !isGenerating) {
      loadSuggestions()
    }
  }, [isExpanded])

  const loadSuggestions = async () => {
    const results = await suggestReplies(stickContent, stickTopic)
    setSuggestions(results)
  }

  if (!isExpanded) {
    return (
      <Button variant="outline" size="sm" onClick={() => setIsExpanded(true)}>
        <Lightbulb className="h-4 w-4 mr-2" />
        Get AI Reply Suggestions
      </Button>
    )
  }

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-yellow-500" />
          <span className="text-sm font-medium">AI Reply Suggestions</span>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setIsExpanded(false)}>
          Hide
        </Button>
      </div>

      {isGenerating ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="ml-2 text-sm text-muted-foreground">Generating suggestions...</span>
        </div>
      ) : suggestions.length > 0 ? (
        <div className="space-y-2">
          {suggestions.map((suggestion, index) => (
            <Button
              key={index}
              variant="outline"
              className="w-full justify-start text-left h-auto py-3 bg-transparent"
              onClick={() => {
                onSelectSuggestion(suggestion)
                setIsExpanded(false)
              }}
            >
              <span className="text-sm">{suggestion}</span>
            </Button>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-2">No suggestions available</p>
      )}
    </Card>
  )
}

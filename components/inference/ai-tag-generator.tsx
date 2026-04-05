"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Sparkles, Loader2, X } from "lucide-react"
import { useAIFeatures } from "@/hooks/use-ai-features"

interface AITagGeneratorProps {
  content: string
  topic?: string
  onTagsGenerated: (tags: string[]) => void
  existingTags?: string[]
}

export function AITagGenerator({ content, topic, onTagsGenerated, existingTags = [] }: Readonly<AITagGeneratorProps>) {
  const { generateTags, isGenerating } = useAIFeatures()
  const [generatedTags, setGeneratedTags] = useState<string[]>([])

  const handleGenerateTags = async () => {
    const tags = await generateTags(content, topic)
    setGeneratedTags(tags)
  }

  const handleAddTag = (tag: string) => {
    if (!existingTags.includes(tag)) {
      onTagsGenerated([...existingTags, tag])
    }
    setGeneratedTags((prev) => prev.filter((t) => t !== tag))
  }

  const handleAddAllTags = () => {
    const newTags = generatedTags.filter((tag) => !existingTags.includes(tag))
    onTagsGenerated([...existingTags, ...newTags])
    setGeneratedTags([])
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={handleGenerateTags} disabled={isGenerating || !content}>
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 mr-2" />
              Generate Tags with AI
            </>
          )}
        </Button>
        {generatedTags.length > 0 && (
          <Button variant="link" size="sm" onClick={handleAddAllTags}>
            Add All
          </Button>
        )}
      </div>

      {generatedTags.length > 0 && (
        <div className="flex flex-wrap gap-2 p-3 bg-muted rounded-md">
          {generatedTags.map((tag) => (
            <Badge
              key={tag}
              variant="secondary"
              className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
              onClick={() => handleAddTag(tag)}
            >
              {tag}
              <X className="h-3 w-3 ml-1" />
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}

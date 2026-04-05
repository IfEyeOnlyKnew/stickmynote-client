"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { Tag, X, Plus, Sparkles, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { useNotedTags } from "@/hooks/useNotedTags"

const TAG_COLORS = [
  "#6b7280", "#ef4444", "#f97316", "#eab308",
  "#22c55e", "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899",
]

interface NotedPageTagsProps {
  pageId: string
  title: string
  content: string
}

export function NotedPageTags({ pageId, title, content }: Readonly<NotedPageTagsProps>) {
  const {
    allTags, pageTags, suggestions, suggesting,
    fetchAllTags, fetchPageTags, addTagToPage,
    removeTagFromPage, suggestTags,
  } = useNotedTags()

  const [newTagName, setNewTagName] = useState("")
  const [selectedColor, setSelectedColor] = useState(TAG_COLORS[0])
  const [popoverOpen, setPopoverOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchPageTags(pageId)
    fetchAllTags()
  }, [pageId, fetchPageTags, fetchAllTags])

  const handleAddTag = useCallback(async (tagIdOrName: string, color?: string) => {
    await addTagToPage(pageId, tagIdOrName, color)
    setNewTagName("")
  }, [pageId, addTagToPage])

  const handleRemoveTag = useCallback(async (tagId: string) => {
    await removeTagFromPage(pageId, tagId)
  }, [pageId, removeTagFromPage])

  const handleSuggest = useCallback(() => {
    suggestTags(title, content)
  }, [title, content, suggestTags])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && newTagName.trim()) {
      e.preventDefault()
      handleAddTag(newTagName.trim(), selectedColor)
    }
  }, [newTagName, selectedColor, handleAddTag])

  // Filter existing tags not already on the page
  const availableTags = allTags.filter(
    (t) => !pageTags.some((pt) => pt.id === t.id)
  )
  const filteredAvailable = newTagName
    ? availableTags.filter((t) =>
        t.name.toLowerCase().includes(newTagName.toLowerCase())
      )
    : availableTags

  return (
    <div className="flex items-center gap-1.5 flex-wrap px-4 py-1.5 border-b bg-muted/10">
      <Tag className="h-3.5 w-3.5 text-muted-foreground shrink-0" />

      {/* Current tags */}
      {pageTags.map((tag) => (
        <Badge
          key={tag.id}
          variant="secondary"
          className="text-[11px] gap-1 pr-1"
          style={{ borderColor: tag.color, borderWidth: 1 }}
        >
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: tag.color }}
          />
          {tag.name}
          <button
            type="button"
            onClick={() => handleRemoveTag(tag.id)}
            className="hover:bg-muted rounded-sm p-0.5"
          >
            <X className="h-2.5 w-2.5" />
          </button>
        </Badge>
      ))}

      {/* Add tag popover */}
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="h-6 text-[11px] px-1.5 gap-1">
            <Plus className="h-3 w-3" />
            Add Tag
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-2" align="start">
          <div className="space-y-2">
            <Input
              ref={inputRef}
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type tag name..."
              className="h-7 text-xs"
              autoFocus
            />

            {/* Color picker */}
            <div className="flex gap-1">
              {TAG_COLORS.map((color) => (
                <button
                  type="button"
                  key={color}
                  onClick={() => setSelectedColor(color)}
                  className={cn(
                    "w-5 h-5 rounded-full transition-all",
                    selectedColor === color && "ring-2 ring-offset-1 ring-primary"
                  )}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>

            {/* AI Suggest button */}
            <Button
              variant="outline"
              size="sm"
              className="w-full h-7 text-[11px] gap-1"
              onClick={handleSuggest}
              disabled={suggesting}
            >
              {suggesting ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Sparkles className="h-3 w-3" />
              )}
              {suggesting ? "Analyzing..." : "AI Suggest Tags"}
            </Button>

            {/* AI suggestions */}
            {suggestions.length > 0 && (
              <div className="space-y-1">
                <span className="text-[10px] text-muted-foreground font-medium uppercase">Suggestions</span>
                <div className="flex flex-wrap gap-1">
                  {suggestions.map((s) => (
                    <Badge
                      key={s}
                      variant="outline"
                      className="text-[10px] cursor-pointer hover:bg-muted"
                      onClick={() => handleAddTag(s, selectedColor)}
                    >
                      <Plus className="h-2.5 w-2.5 mr-0.5" />
                      {s}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Existing tags */}
            {filteredAvailable.length > 0 && (
              <div className="space-y-1">
                <span className="text-[10px] text-muted-foreground font-medium uppercase">Existing Tags</span>
                <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                  {filteredAvailable.slice(0, 20).map((tag) => (
                    <Badge
                      key={tag.id}
                      variant="outline"
                      className="text-[10px] cursor-pointer hover:bg-muted gap-1"
                      onClick={() => handleAddTag(tag.id)}
                    >
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: tag.color }}
                      />
                      {tag.name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Create new tag hint */}
            {newTagName.trim() && !filteredAvailable.some(
              (t) => t.name.toLowerCase() === newTagName.trim().toLowerCase()
            ) && (
              <button
                type="button"
                onClick={() => handleAddTag(newTagName.trim(), selectedColor)}
                className="w-full text-left text-xs text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted"
              >
                Create &quot;{newTagName.trim()}&quot;
              </button>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}

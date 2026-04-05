"use client"
import { useState } from "react"
import { Filter, Calendar, TagIcon, Users, SlidersHorizontal, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export interface SearchFilters {
  tags?: string[]
  timeframe?: "day" | "week" | "month" | "all"
  shared?: "all" | "shared" | "personal"
  colors?: string[]
  sortBy?: "relevance" | "newest" | "oldest" | "most_replies"
}

interface SearchFiltersProps {
  filters: SearchFilters
  onChange: (filters: SearchFilters) => void
  availableTags?: string[]
  availableColors?: string[]
}

export function SearchFiltersPanel({
  filters,
  onChange,
  availableTags = [],
  availableColors = ["yellow", "pink", "blue", "green", "purple", "orange"],
}: Readonly<SearchFiltersProps>) {
  const [open, setOpen] = useState(false)

  const activeFilterCount = [
    filters.tags?.length || 0,
    filters.timeframe && filters.timeframe !== "all" ? 1 : 0,
    filters.shared && filters.shared !== "all" ? 1 : 0,
    filters.colors?.length || 0,
  ].reduce((a, b) => a + b, 0)

  const handleTagToggle = (tag: string) => {
    const currentTags = filters.tags || []
    const newTags = currentTags.includes(tag) ? currentTags.filter((t) => t !== tag) : [...currentTags, tag]

    onChange({ ...filters, tags: newTags.length > 0 ? newTags : undefined })
  }

  const handleColorToggle = (color: string) => {
    const currentColors = filters.colors || []
    const newColors = currentColors.includes(color)
      ? currentColors.filter((c) => c !== color)
      : [...currentColors, color]

    onChange({ ...filters, colors: newColors.length > 0 ? newColors : undefined })
  }

  const handleClearFilters = () => {
    onChange({
      sortBy: filters.sortBy || "relevance",
    })
  }

  const hasActiveFilters = activeFilterCount > 0

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Sort dropdown */}
      <Select
        value={filters.sortBy || "relevance"}
        onValueChange={(value) => onChange({ ...filters, sortBy: value as SearchFilters["sortBy"] })}
      >
        <SelectTrigger className="w-[140px] h-9 bg-white border-indigo-200 focus:ring-indigo-400">
          <SlidersHorizontal className="h-4 w-4 mr-2 text-indigo-500" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="relevance">Relevance</SelectItem>
          <SelectItem value="newest">Newest</SelectItem>
          <SelectItem value="oldest">Oldest</SelectItem>
          <SelectItem value="most_replies">Most Replies</SelectItem>
        </SelectContent>
      </Select>

      {/* Filters popover */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-9 border-indigo-200 hover:bg-indigo-50 relative bg-transparent"
          >
            <Filter className="h-4 w-4 mr-2 text-indigo-500" />
            Filters
            {activeFilterCount > 0 && (
              <Badge className="ml-2 h-5 w-5 p-0 flex items-center justify-center rounded-full bg-indigo-500 text-white text-xs">
                {activeFilterCount}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="start">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Filter Results</h3>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={handleClearFilters} className="h-7 text-xs">
                Clear all
              </Button>
            )}
          </div>

          <div className="p-4 space-y-6 max-h-[500px] overflow-y-auto">
            {/* Timeframe filter */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-indigo-500" />
                <Label className="text-sm font-semibold">Timeframe</Label>
              </div>
              <Select
                value={filters.timeframe || "all"}
                onValueChange={(value) => onChange({ ...filters, timeframe: value as SearchFilters["timeframe"] })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All time</SelectItem>
                  <SelectItem value="day">Last 24 hours</SelectItem>
                  <SelectItem value="week">Last week</SelectItem>
                  <SelectItem value="month">Last month</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Shared filter */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-indigo-500" />
                <Label className="text-sm font-semibold">Visibility</Label>
              </div>
              <Select
                value={filters.shared || "all"}
                onValueChange={(value) => onChange({ ...filters, shared: value as SearchFilters["shared"] })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All notes</SelectItem>
                  <SelectItem value="shared">Shared only</SelectItem>
                  <SelectItem value="personal">Personal only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Tags filter */}
            {availableTags.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <TagIcon className="h-4 w-4 text-indigo-500" />
                  <Label className="text-sm font-semibold">Tags</Label>
                </div>
                <div className="flex flex-wrap gap-2">
                  {availableTags.slice(0, 10).map((tag) => (
                    <Badge
                      key={tag}
                      variant={filters.tags?.includes(tag) ? "default" : "outline"}
                      className={`cursor-pointer transition-colors ${
                        filters.tags?.includes(tag)
                          ? "bg-indigo-500 hover:bg-indigo-600"
                          : "hover:bg-indigo-50 border-indigo-200"
                      }`}
                      onClick={() => handleTagToggle(tag)}
                    >
                      #{tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Color filter */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Note Color</Label>
              <div className="grid grid-cols-6 gap-2">
                {availableColors.map((color) => {
                  const isSelected = filters.colors?.includes(color)
                  return (
                    <button
                      key={color}
                      onClick={() => handleColorToggle(color)}
                      className={`h-10 w-10 rounded-lg transition-all ${
                        isSelected ? "ring-2 ring-indigo-500 ring-offset-2 scale-110" : "hover:scale-105"
                      }`}
                      style={{ backgroundColor: color }}
                      title={color}
                      aria-label={`Filter by ${color}`}
                    >
                      {isSelected && (
                        <div className="flex items-center justify-center h-full">
                          <div className="h-3 w-3 bg-white rounded-full" />
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Active filter badges */}
      {filters.tags?.map((tag) => (
        <Badge
          key={tag}
          variant="secondary"
          className="bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100 cursor-pointer"
          onClick={() => handleTagToggle(tag)}
        >
          #{tag}
          <X className="ml-1 h-3 w-3" />
        </Badge>
      ))}

      {filters.timeframe && filters.timeframe !== "all" && (
        <Badge
          variant="secondary"
          className="bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100 cursor-pointer"
          onClick={() => onChange({ ...filters, timeframe: "all" })}
        >
          <Calendar className="mr-1 h-3 w-3" />
          {filters.timeframe}
          <X className="ml-1 h-3 w-3" />
        </Badge>
      )}
    </div>
  )
}

"use client"

import { Search, TrendingUp, Sparkles, FileQuestion } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

interface SearchEmptyStateProps {
  type: "no-query" | "no-results"
  searchQuery?: string
  trendingTags?: string[]
  onTagClick?: (tag: string) => void
  onClearFilters?: () => void
}

export function SearchEmptyState({
  type,
  searchQuery,
  trendingTags = [],
  onTagClick,
  onClearFilters,
}: SearchEmptyStateProps) {
  if (type === "no-query") {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center mb-6">
          <Search className="h-10 w-10 text-indigo-500" />
        </div>
        <h3 className="text-2xl font-bold text-gray-900 mb-2">Discover Shared Notes</h3>
        <p className="text-gray-500 text-center max-w-md mb-8">
          Search for topics, tags, or authors to find notes shared by the community
        </p>

        {/* Search tips */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mb-8">
          <div className="bg-white p-4 rounded-xl border-2 border-indigo-100 shadow-sm">
            <Sparkles className="h-5 w-5 text-indigo-500 mb-2" />
            <h4 className="font-semibold text-sm text-gray-900 mb-1">Use Keywords</h4>
            <p className="text-xs text-gray-500">Try searching for "design tips" or "productivity"</p>
          </div>
          <div className="bg-white p-4 rounded-xl border-2 border-purple-100 shadow-sm">
            <TrendingUp className="h-5 w-5 text-purple-500 mb-2" />
            <h4 className="font-semibold text-sm text-gray-900 mb-1">Explore Tags</h4>
            <p className="text-xs text-gray-500">Filter by tags like #javascript or #design</p>
          </div>
          <div className="bg-white p-4 rounded-xl border-2 border-pink-100 shadow-sm">
            <FileQuestion className="h-5 w-5 text-pink-500 mb-2" />
            <h4 className="font-semibold text-sm text-gray-900 mb-1">Find Authors</h4>
            <p className="text-xs text-gray-500">Search for notes by specific authors</p>
          </div>
        </div>

        {/* Trending tags */}
        {trendingTags.length > 0 && (
          <div className="w-full max-w-2xl">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="h-5 w-5 text-orange-500" />
              <h4 className="font-semibold text-gray-900">Trending Topics</h4>
            </div>
            <div className="flex flex-wrap gap-2 justify-center">
              {trendingTags.slice(0, 12).map((tag) => (
                <Badge
                  key={tag}
                  variant="outline"
                  className="cursor-pointer hover:bg-indigo-50 hover:border-indigo-300 transition-colors px-4 py-2 text-sm border-indigo-200"
                  onClick={() => onTagClick?.(tag)}
                >
                  #{tag}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  // No results state
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-orange-100 to-red-100 flex items-center justify-center mb-6">
        <FileQuestion className="h-10 w-10 text-orange-500" />
      </div>
      <h3 className="text-2xl font-bold text-gray-900 mb-2">No Results Found</h3>
      <p className="text-gray-500 text-center max-w-md mb-8">
        {searchQuery ? (
          <>
            We couldn't find any notes matching <span className="font-semibold text-gray-700">"{searchQuery}"</span>
          </>
        ) : (
          "Try adjusting your filters or search term"
        )}
      </p>

      {/* Suggestions */}
      <div className="bg-white p-6 rounded-xl border-2 border-gray-100 shadow-sm max-w-md">
        <h4 className="font-semibold text-gray-900 mb-3">Try these suggestions:</h4>
        <ul className="space-y-2 text-sm text-gray-600">
          <li className="flex items-start gap-2">
            <span className="text-indigo-500 mt-0.5">•</span>
            <span>Check your spelling or try different keywords</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-indigo-500 mt-0.5">•</span>
            <span>Use more general terms or fewer filters</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-indigo-500 mt-0.5">•</span>
            <span>Search for related topics or tags</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-indigo-500 mt-0.5">•</span>
            <span>Try browsing trending topics below</span>
          </li>
        </ul>
      </div>

      {/* Actions */}
      <div className="flex gap-3 mt-8">
        {onClearFilters && (
          <Button
            variant="outline"
            onClick={onClearFilters}
            className="border-indigo-200 hover:bg-indigo-50 bg-transparent"
          >
            Clear Filters
          </Button>
        )}
        {trendingTags.length > 0 && (
          <div className="flex gap-2">
            {trendingTags.slice(0, 3).map((tag) => (
              <Badge
                key={tag}
                variant="secondary"
                className="cursor-pointer hover:bg-indigo-100 bg-indigo-50 text-indigo-700 border-indigo-200 px-3 py-1"
                onClick={() => onTagClick?.(tag)}
              >
                #{tag}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

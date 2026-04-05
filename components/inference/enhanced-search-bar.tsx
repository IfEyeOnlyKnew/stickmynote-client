"use client"

import { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Search, History, Star, X, Save } from "lucide-react"
import { useEnhancedSearch } from "@/hooks/use-enhanced-search"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"

interface EnhancedSearchBarProps {
  items: any[]
  onResultsChange: (results: any[]) => void
  placeholder?: string
}

export function EnhancedSearchBar({ items, onResultsChange, placeholder }: Readonly<EnhancedSearchBarProps>) {
  const {
    query,
    setQuery,
    results,
    savedFilters,
    activeFilter,
    searchHistory,
    saveFilter,
    applyFilter,
    clearFilter,
    clearHistory,
  } = useEnhancedSearch(items, ["topic", "content"])

  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [filterName, setFilterName] = useState("")

  // Update parent with results
  useEffect(() => {
    onResultsChange(results.map((r) => r.item))
  }, [results, onResultsChange])

  const handleSaveFilter = async () => {
    if (!filterName.trim()) return

    await saveFilter(filterName, { query })
    setFilterName("")
    setSaveDialogOpen(false)
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder || "Search sticks..."}
            className="pl-10 pr-10"
          />
          {query && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7 p-0"
              onClick={() => setQuery("")}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon">
              <History className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel>Search History</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {searchHistory.length > 0 ? (
              <>
                {searchHistory.map((item) => (
                  <DropdownMenuItem key={item} onClick={() => setQuery(item)}>
                    <History className="h-4 w-4 mr-2" />
                    {item}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={clearHistory} className="text-destructive">
                  Clear History
                </DropdownMenuItem>
              </>
            ) : (
              <div className="px-2 py-4 text-sm text-muted-foreground text-center">No search history</div>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon">
              <Star className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel>Saved Filters</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {savedFilters.length > 0 ? (
              <>
                {savedFilters.map((filter) => (
                  <DropdownMenuItem key={filter.id} onClick={() => applyFilter(filter)}>
                    <Star className="h-4 w-4 mr-2" />
                    {filter.name}
                  </DropdownMenuItem>
                ))}
              </>
            ) : (
              <div className="px-2 py-4 text-sm text-muted-foreground text-center">No saved filters</div>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {query && (
          <Button variant="outline" size="icon" onClick={() => setSaveDialogOpen(true)}>
            <Save className="h-4 w-4" />
          </Button>
        )}
      </div>

      {activeFilter && (
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="gap-1">
            <Star className="h-3 w-3" />
            {activeFilter.name}
          </Badge>
          <Button variant="ghost" size="sm" onClick={clearFilter}>
            Clear
          </Button>
        </div>
      )}

      {results.length > 0 && query && (
        <p className="text-sm text-muted-foreground">
          Found {results.length} result{results.length === 1 ? "" : "s"}
        </p>
      )}

      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Search Filter</DialogTitle>
            <DialogDescription>Give your search filter a name to save it for later use.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="filter-name">Filter Name</Label>
            <Input
              id="filter-name"
              value={filterName}
              onChange={(e) => setFilterName(e.target.value)}
              placeholder="e.g., Important Tasks"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveFilter} disabled={!filterName.trim()}>
              Save Filter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

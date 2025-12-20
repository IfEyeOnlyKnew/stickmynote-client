"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useUser } from "@/contexts/user-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Search, Filter, Save, X, CalendarIcon, Loader2, StickyNote, Bookmark, Trash2 } from "lucide-react"
import { useAdvancedSearch, useSavedSearches } from "@/hooks/use-advanced-search"
import type { SearchFilters } from "@/types/search"
import { format } from "date-fns"
import { Header } from "@/components/header"

// Helper function to format date range display
function formatDateRangeDisplay(dateRange: { from: Date | null; to: Date | null } | undefined): string {
  if (!dateRange?.from) return "Pick a date range"
  if (dateRange.to) {
    return `${format(dateRange.from, "MMM d")} - ${format(dateRange.to, "MMM d, yyyy")}`
  }
  return format(dateRange.from, "MMM d, yyyy")
}

// Helper function to get visibility select value
function getVisibilityValue(shared: boolean | null | undefined): string {
  if (shared === null || shared === undefined) return "all"
  return shared ? "shared" : "personal"
}

export default function SearchPage() {
  const router = useRouter()
  const { user } = useUser()
  const { results, totalCount, loading, search } = useAdvancedSearch()
  const { savedSearches, fetchSavedSearches, saveSearch, deleteSearch } = useSavedSearches()

  const [query, setQuery] = useState("")
  const [filters, setFilters] = useState<SearchFilters>({
    dateRange: { from: null, to: null },
    shared: null,
    color: "",
    tags: [],
  })
  const [showFilters, setShowFilters] = useState(false)
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [searchName, setSearchName] = useState("")

  useEffect(() => {
    if (user) {
      fetchSavedSearches()
    }
  }, [user, fetchSavedSearches])

  const handleSearch = () => {
    search({
      query,
      filters,
      page: 1,
      limit: 20,
      sortBy: "created_at",
      sortOrder: "desc",
    })
  }

  const handleSaveSearch = async () => {
    if (!searchName.trim()) return

    try {
      await saveSearch(searchName, query, filters)
      setSaveDialogOpen(false)
      setSearchName("")
    } catch (error) {
      console.error("[v0] Error saving search:", error)
    }
  }

  const handleLoadSavedSearch = (savedSearch: any) => {
    setQuery(savedSearch.query)
    setFilters(savedSearch.filters)
    search({
      query: savedSearch.query,
      filters: savedSearch.filters,
      page: 1,
      limit: 20,
    })
  }

  const clearFilters = () => {
    setFilters({
      dateRange: { from: null, to: null },
      shared: null,
      color: "",
      tags: [],
    })
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex items-center justify-center py-20">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Sign in required</CardTitle>
              <CardDescription>You must be signed in to search notes</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => router.push("/auth/login")} className="w-full">
                Sign In
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Advanced Search</h1>
          <p className="text-muted-foreground">Search and filter your notes with powerful options</p>
        </div>

        <div className="grid lg:grid-cols-4 gap-6">
          {/* Sidebar: Saved Searches */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Bookmark className="h-4 w-4" />
                  Saved Searches
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {savedSearches.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No saved searches</p>
                ) : (
                  savedSearches.map((saved) => (
                    <div
                      key={saved.id}
                      className="flex items-center justify-between p-2 hover:bg-muted rounded-lg group"
                    >
                      <button
                        onClick={() => handleLoadSavedSearch(saved)}
                        className="flex-1 text-left text-sm truncate"
                      >
                        {saved.name}
                      </button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100"
                        onClick={() => deleteSearch(saved.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3 space-y-6">
            {/* Search Bar */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search notes..."
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                      className="pl-10"
                    />
                  </div>
                  <Button onClick={handleSearch} disabled={loading}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
                  </Button>
                  <Button variant="outline" onClick={() => setShowFilters(!showFilters)}>
                    <Filter className="h-4 w-4 mr-2" />
                    Filters
                  </Button>
                  <Button variant="outline" onClick={() => setSaveDialogOpen(true)} disabled={!query}>
                    <Save className="h-4 w-4" />
                  </Button>
                </div>

                {/* Filters Panel */}
                {showFilters && (
                  <div className="mt-4 p-4 border rounded-lg space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold">Filters</h3>
                      <Button variant="ghost" size="sm" onClick={clearFilters}>
                        <X className="h-4 w-4 mr-1" />
                        Clear
                      </Button>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      {/* Date Range */}
                      <div className="space-y-2">
                        <Label>Date Range</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="w-full justify-start bg-transparent">
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {formatDateRangeDisplay(filters.dateRange)}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="range"
                              selected={{
                                from: filters.dateRange?.from || undefined,
                                to: filters.dateRange?.to || undefined,
                              }}
                              onSelect={(range) => {
                                setFilters({
                                  ...filters,
                                  dateRange: {
                                    from: range?.from || null,
                                    to: range?.to || null,
                                  },
                                })
                              }}
                            />
                          </PopoverContent>
                        </Popover>
                      </div>

                      {/* Shared Filter */}
                      <div className="space-y-2">
                        <Label>Visibility</Label>
                        <Select
                          value={getVisibilityValue(filters.shared)}
                          onValueChange={(value) => {
                            setFilters({
                              ...filters,
                              shared: value === "all" ? null : value === "shared",
                            })
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Notes</SelectItem>
                            <SelectItem value="personal">Personal Only</SelectItem>
                            <SelectItem value="shared">Shared Only</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Save Search Dialog */}
            {saveDialogOpen && (
              <Card className="border-blue-200 bg-blue-50/50">
                <CardHeader>
                  <CardTitle className="text-base">Save This Search</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Search Name</Label>
                    <Input
                      placeholder="e.g., Work Notes from Last Week"
                      value={searchName}
                      onChange={(e) => setSearchName(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleSaveSearch} disabled={!searchName.trim()}>
                      Save Search
                    </Button>
                    <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Results */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">
                    Search Results
                    {totalCount > 0 && (
                      <Badge variant="secondary" className="ml-2">
                        {totalCount}
                      </Badge>
                    )}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                {loading && (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                )}
                {!loading && results.length === 0 && (
                  <div className="text-center py-12">
                    <StickyNote className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">
                      {query ? "No notes found matching your search" : "Enter a search query to get started"}
                    </p>
                  </div>
                )}
                {!loading && results.length > 0 && (
                  <div className="space-y-3">
                    {results.map((note) => (
                      <button
                        type="button"
                        key={note.id}
                        className="w-full text-left p-4 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                        onClick={() => router.push(`/personal?note=${note.id}`)}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold mb-1 truncate">{note.topic || "Untitled"}</h3>
                            <p className="text-sm text-muted-foreground line-clamp-2">{note.content}</p>
                            <div className="flex items-center gap-2 mt-2">
                              {note.is_shared && (
                                <Badge variant="secondary" className="text-xs">
                                  Shared
                                </Badge>
                              )}
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(note.created_at), "MMM d, yyyy")}
                              </span>
                            </div>
                          </div>
                          <div className="w-12 h-12 rounded-lg flex-shrink-0" style={{ backgroundColor: note.color }} />
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}

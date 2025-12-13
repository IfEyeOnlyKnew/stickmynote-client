"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { BreadcrumbNav } from "@/components/breadcrumb-nav"
import { useUser } from "@/contexts/user-context"
import {
  Search,
  Globe,
  Lock,
  Calendar,
  MessageSquare,
  User,
  Folder,
  SlidersHorizontal,
  TrendingUp,
  Clock,
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"

interface SearchMetadata {
  totalSticks: number
  totalReplies: number
  authors: Array<{ id: string; name: string; email: string }>
  pads: Array<{ id: string; name: string }>
}

interface SocialStick {
  id: string
  topic: string
  content: string
  color: string
  created_at: string
  updated_at: string
  social_pad_id: string
  user_id: string
  is_public: boolean
  social_pads: {
    id: string
    name: string
    is_public: boolean
  }
  users: {
    id: string
    full_name: string | null
    email: string
    username: string | null
    avatar_url: string | null
  }
  reply_count: number
}

interface ReplyResult {
  id: string
  content: string
  category: string
  created_at: string
  social_stick_id: string
  users: {
    id: string
    full_name: string | null
    email: string
  }
  social_sticks: {
    id: string
    topic: string
    social_pads: {
      name: string
    }
  }
}

export default function SocialSearchPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, loading: userLoading } = useUser()
  const [query, setQuery] = useState(searchParams.get("q") || "")
  const [stickResults, setStickResults] = useState<SocialStick[]>([])
  const [replyResults, setReplyResults] = useState<ReplyResult[]>([])
  const [metadata, setMetadata] = useState<SearchMetadata | null>(null)
  const [loading, setLoading] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [activeTab, setActiveTab] = useState<"sticks" | "replies">("sticks")

  // Filter states
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [visibility, setVisibility] = useState<"public" | "private" | "all">("all")
  const [selectedAuthor, setSelectedAuthor] = useState<string>("")
  const [selectedPad, setSelectedPad] = useState<string>("")
  const [includeReplies, setIncludeReplies] = useState(true)
  const [sortBy, setSortBy] = useState<"created_at" | "replies" | "updated_at">("created_at")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")

  useEffect(() => {
    const q = searchParams.get("q")
    if (q && q !== query) {
      setQuery(q)
      performSearch(q)
    }
  }, [searchParams])

  const performSearch = async (searchQuery = query) => {
    if (!searchQuery.trim() && !selectedAuthor && !selectedPad) return

    setLoading(true)
    try {
      const params = new URLSearchParams({
        q: searchQuery,
        ...(dateFrom && { dateFrom }),
        ...(dateTo && { dateTo }),
        ...(visibility !== "all" && { visibility }),
        ...(selectedAuthor && { authorId: selectedAuthor }),
        ...(selectedPad && { padId: selectedPad }),
        includeReplies: includeReplies.toString(),
        sortBy,
        sortOrder,
      })

      const response = await fetch(`/api/social-search?${params}`)
      if (response.ok) {
        const data = await response.json()
        setStickResults(data.sticks || [])
        setReplyResults(data.replies || [])
        setMetadata(data.metadata)
      }
    } catch (error) {
      console.error("[v0] Error performing search:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim()) {
      router.push(`/social/search?q=${encodeURIComponent(query)}`)
    }
    performSearch()
  }

  const clearFilters = () => {
    setDateFrom("")
    setDateTo("")
    setVisibility("all")
    setSelectedAuthor("")
    setSelectedPad("")
    setSortBy("created_at")
    setSortOrder("desc")
  }

  if (userLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
      </div>
    )
  }

  if (!user) {
    router.push("/auth")
    return null
  }

  const hasActiveFilters =
    dateFrom || dateTo || visibility !== "all" || selectedAuthor || selectedPad || sortBy !== "created_at"

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <BreadcrumbNav
          items={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Social", href: "/social" },
            { label: "Search", current: true },
          ]}
        />

        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Enhanced Social Search</h1>
          <p className="text-gray-600">Advanced search with filters across sticks, replies, authors, and pads</p>
        </div>

        <div className="grid grid-cols-12 gap-6">
          {/* Advanced Filters Sidebar */}
          <div className="col-span-12 lg:col-span-3 space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <SlidersHorizontal className="h-4 w-4" />
                  Filters
                </CardTitle>
                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" onClick={clearFilters} className="h-7 text-xs">
                    Clear
                  </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Date Range */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Date Range
                  </Label>
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    placeholder="From"
                    className="text-sm"
                  />
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    placeholder="To"
                    className="text-sm"
                  />
                </div>

                {/* Visibility */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold flex items-center gap-1">
                    <Globe className="h-3 w-3" />
                    Visibility
                  </Label>
                  <Select value={visibility} onValueChange={(v: any) => setVisibility(v)}>
                    <SelectTrigger className="text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Sticks</SelectItem>
                      <SelectItem value="public">Public Only</SelectItem>
                      <SelectItem value="private">Private Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Author Filter */}
                {metadata && metadata.authors.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold flex items-center gap-1">
                      <User className="h-3 w-3" />
                      Author
                    </Label>
                    <Select value={selectedAuthor} onValueChange={setSelectedAuthor}>
                      <SelectTrigger className="text-sm">
                        <SelectValue placeholder="All authors" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="allAuthors">All Authors</SelectItem>
                        {metadata.authors.map((author) => (
                          <SelectItem key={author.id} value={author.id}>
                            {author.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Pad Filter */}
                {metadata && metadata.pads.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold flex items-center gap-1">
                      <Folder className="h-3 w-3" />
                      Pad
                    </Label>
                    <Select value={selectedPad} onValueChange={setSelectedPad}>
                      <SelectTrigger className="text-sm">
                        <SelectValue placeholder="All pads" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="allPads">All Pads</SelectItem>
                        {metadata.pads.map((pad) => (
                          <SelectItem key={pad.id} value={pad.id}>
                            {pad.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Sort Options */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" />
                    Sort By
                  </Label>
                  <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
                    <SelectTrigger className="text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="created_at">Date Created</SelectItem>
                      <SelectItem value="updated_at">Last Updated</SelectItem>
                      <SelectItem value="replies">Reply Count</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={sortOrder} onValueChange={(v: any) => setSortOrder(v)}>
                    <SelectTrigger className="text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="desc">Descending</SelectItem>
                      <SelectItem value="asc">Ascending</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Include Replies */}
                <div className="flex items-center space-x-2 pt-2">
                  <Checkbox
                    id="includeReplies"
                    checked={includeReplies}
                    onCheckedChange={(c: boolean) => setIncludeReplies(c)}
                  />
                  <Label htmlFor="includeReplies" className="text-sm cursor-pointer">
                    Search in replies
                  </Label>
                </div>

                <Button onClick={() => performSearch()} className="w-full" size="sm">
                  Apply Filters
                </Button>
              </CardContent>
            </Card>

            {/* Search Stats */}
            {metadata && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Search Results</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Sticks:</span>
                    <span className="font-semibold">{metadata.totalSticks}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Replies:</span>
                    <span className="font-semibold">{metadata.totalReplies}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Authors:</span>
                    <span className="font-semibold">{metadata.authors.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Pads:</span>
                    <span className="font-semibold">{metadata.pads.length}</span>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Main Content */}
          <div className="col-span-12 lg:col-span-9 space-y-4">
            {/* Search Bar */}
            <Card>
              <CardContent className="pt-6">
                <form onSubmit={handleSearch} className="flex gap-2">
                  <Input
                    placeholder="Search topics, content, authors..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="flex-1"
                  />
                  <Button type="submit" disabled={loading}>
                    <Search className="h-4 w-4 mr-2" />
                    {loading ? "Searching..." : "Search"}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Results Tabs */}
            <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)}>
              <TabsList className="grid w-full grid-cols-2 max-w-md">
                <TabsTrigger value="sticks" className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Sticks ({stickResults.length})
                </TabsTrigger>
                <TabsTrigger value="replies" className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Replies ({replyResults.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="sticks" className="space-y-4 mt-6">
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
                  </div>
                ) : stickResults.length > 0 ? (
                  stickResults.map((stick) => (
                    <Card
                      key={stick.id}
                      className="cursor-pointer hover:shadow-lg transition-shadow"
                      onClick={() => router.push(`/social/sticks/${stick.id}`)}
                    >
                      <CardHeader>
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <CardTitle className="text-lg mb-2 flex items-center gap-2">
                              <div className="w-1 h-6 rounded" style={{ backgroundColor: stick.color }} />
                              {stick.topic}
                            </CardTitle>
                            <p className="text-sm text-gray-600 line-clamp-2">{stick.content}</p>
                          </div>
                          <Badge
                            variant={stick.social_pads.is_public ? "default" : "secondary"}
                            className="flex-shrink-0"
                          >
                            {stick.social_pads.is_public ? (
                              <>
                                <Globe className="h-3 w-3 mr-1" />
                                Public
                              </>
                            ) : (
                              <>
                                <Lock className="h-3 w-3 mr-1" />
                                Private
                              </>
                            )}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                          <div className="flex items-center gap-1">
                            <User className="h-4 w-4" />
                            {stick.users?.full_name || stick.users?.email}
                          </div>
                          <div className="flex items-center gap-1">
                            <MessageSquare className="h-4 w-4" />
                            {stick.reply_count} {stick.reply_count === 1 ? "reply" : "replies"}
                          </div>
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            {formatDistanceToNow(new Date(stick.created_at), { addSuffix: true })}
                          </div>
                          <div className="flex items-center gap-1">
                            <Folder className="h-4 w-4" />
                            <span className="font-medium">{stick.social_pads.name}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : query || hasActiveFilters ? (
                  <Card className="text-center py-12">
                    <CardContent>
                      <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-semibold mb-2">No sticks found</h3>
                      <p className="text-gray-600">Try adjusting your search terms or filters</p>
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="text-center py-12">
                    <CardContent>
                      <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-semibold mb-2">Start Searching</h3>
                      <p className="text-gray-600">Enter a search query or apply filters to find sticks</p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="replies" className="space-y-4 mt-6">
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
                  </div>
                ) : replyResults.length > 0 ? (
                  replyResults.map((reply) => (
                    <Card
                      key={reply.id}
                      className="cursor-pointer hover:shadow-lg transition-shadow"
                      onClick={() => router.push(`/social/sticks/${reply.social_stick_id}`)}
                    >
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="text-sm text-gray-600 mb-2">{reply.content}</p>
                            <Badge variant="outline" className="text-xs">
                              {reply.category}
                            </Badge>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
                          <div className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {reply.users?.full_name || reply.users?.email}
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDistanceToNow(new Date(reply.created_at), { addSuffix: true })}
                          </div>
                          <div className="flex items-center gap-1">
                            <MessageSquare className="h-3 w-3" />
                            On: <span className="font-medium">{reply.social_sticks.topic}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Folder className="h-3 w-3" />
                            <span className="font-medium">{reply.social_sticks.social_pads.name}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : query && includeReplies ? (
                  <Card className="text-center py-12">
                    <CardContent>
                      <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-semibold mb-2">No replies found</h3>
                      <p className="text-gray-600">No matching replies for your search query</p>
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="text-center py-12">
                    <CardContent>
                      <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-semibold mb-2">Reply Search</h3>
                      <p className="text-gray-600">
                        {includeReplies
                          ? "Enter a search query to find matching replies"
                          : "Enable 'Search in replies' to search reply content"}
                      </p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  )
}

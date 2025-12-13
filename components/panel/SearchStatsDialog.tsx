"use client"

import { useEffect, useState } from "react"
import { createSupabaseBrowser } from "@/lib/supabase-browser"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { TrendingUp, Search, Heart, Eye, Tag, Clock, BarChart3 } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"

interface SearchStatsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: string
}

interface Stats {
  totalSearches: number
  totalResults: number
  popularQueries: Array<{ query: string; count: number }>
  totalNotes: number
  totalLikes: number
  totalViews: number
  trendingTags: Array<{ tag: string; count: number }>
  recentActivity: Array<{ query: string; created_at: string; results_count: number }>
}

interface SearchHistoryRecord {
  query: string
  results_count: number
  created_at: string
}

interface NoteRecord {
  id: string
  view_count: number | null
}

interface NoteTabRecord {
  tags: any
}

export function SearchStatsDialog({ open, onOpenChange, userId }: SearchStatsDialogProps) {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchStats() {
      if (!open || !userId) return

      setLoading(true)
      try {
        const supabase = createSupabaseBrowser()

        // Fetch search history stats
        const { data: searchHistory, error: searchError } = await supabase
          .from("search_history")
          .select("query, results_count, created_at")
          .order("created_at", { ascending: false })
          .limit(100)

        if (searchError) throw searchError

        // Calculate popular queries
        const queryMap = new Map<string, number>()
        const typedSearchHistory = (searchHistory || []) as SearchHistoryRecord[]
        typedSearchHistory.forEach((search) => {
          if (search.query) {
            queryMap.set(search.query, (queryMap.get(search.query) || 0) + 1)
          }
        })
        const popularQueries = Array.from(queryMap.entries())
          .map(([query, count]) => ({ query, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5)

        // Fetch community notes stats
        const { data: notes, error: notesError } = await supabase
          .from("notes")
          .select("id, view_count")
          .eq("is_shared", true)

        if (notesError) throw notesError

        // Fetch total likes
        const { count: likesCount, error: likesError } = await supabase
          .from("note_reactions")
          .select("*", { count: "exact", head: true })
          .eq("reaction_type", "like")

        if (likesError) throw likesError

        // Fetch trending tags
        const { data: noteTabs, error: tagsError } = await supabase
          .from("note_tabs")
          .select("tags")
          .not("tags", "is", null)
          .limit(200)

        if (tagsError) throw tagsError

        // Process tags
        const tagMap = new Map<string, number>()
        const typedNoteTabs = (noteTabs || []) as NoteTabRecord[]
        typedNoteTabs.forEach((tab) => {
          if (tab.tags) {
            const tags = Array.isArray(tab.tags) ? tab.tags : Object.values(tab.tags)
            tags.forEach((tag: any) => {
              const tagString = typeof tag === "string" ? tag : String(tag)
              if (tagString) {
                tagMap.set(tagString, (tagMap.get(tagString) || 0) + 1)
              }
            })
          }
        })
        const trendingTags = Array.from(tagMap.entries())
          .map(([tag, count]) => ({ tag, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 8)

        const typedNotes = (notes || []) as NoteRecord[]
        setStats({
          totalSearches: typedSearchHistory.length,
          totalResults: typedSearchHistory.reduce((sum, s) => sum + (s.results_count || 0), 0),
          popularQueries,
          totalNotes: typedNotes.length,
          totalLikes: likesCount || 0,
          totalViews: typedNotes.reduce((sum, n) => sum + (n.view_count || 0), 0),
          trendingTags,
          recentActivity: typedSearchHistory.slice(0, 5),
        })
      } catch (error) {
        console.error("[v0] Error fetching stats:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [open, userId])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <BarChart3 className="h-6 w-6 text-indigo-600" />
            Community Sticks Statistics
          </DialogTitle>
          <DialogDescription>Insights and analytics for search activity and community engagement</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardHeader>
                    <Skeleton className="h-4 w-24" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-8 w-16" />
                  </CardContent>
                </Card>
              ))}
            </div>
            <Skeleton className="h-64 w-full" />
          </div>
        ) : stats ? (
          <div className="space-y-6">
            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="border-indigo-200 bg-gradient-to-br from-indigo-50 to-white">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Search className="h-4 w-4 text-indigo-600" />
                    Total Searches
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-indigo-600">{stats.totalSearches}</div>
                  <p className="text-xs text-gray-500 mt-1">{stats.totalResults} total results</p>
                </CardContent>
              </Card>

              <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-white">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Heart className="h-4 w-4 text-purple-600" />
                    Community Likes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-purple-600">{stats.totalLikes}</div>
                  <p className="text-xs text-gray-500 mt-1">Across {stats.totalNotes} shared notes</p>
                </CardContent>
              </Card>

              <Card className="border-pink-200 bg-gradient-to-br from-pink-50 to-white">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Eye className="h-4 w-4 text-pink-600" />
                    Total Views
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-pink-600">{stats.totalViews}</div>
                  <p className="text-xs text-gray-500 mt-1">Community engagement</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Popular Searches */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-indigo-600" />
                    Popular Searches
                  </CardTitle>
                  <CardDescription>Most frequently searched queries</CardDescription>
                </CardHeader>
                <CardContent>
                  {stats.popularQueries.length > 0 ? (
                    <div className="space-y-3">
                      {stats.popularQueries.map((item, index) => (
                        <div key={index} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 text-xs font-bold">
                              {index + 1}
                            </span>
                            <span className="text-sm font-medium truncate max-w-[200px]">{item.query}</span>
                          </div>
                          <Badge variant="secondary" className="text-xs">
                            {item.count} {item.count === 1 ? "search" : "searches"}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 text-center py-4">No search data yet</p>
                  )}
                </CardContent>
              </Card>

              {/* Trending Tags */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Tag className="h-5 w-5 text-purple-600" />
                    Trending Tags
                  </CardTitle>
                  <CardDescription>Most popular tags in the community</CardDescription>
                </CardHeader>
                <CardContent>
                  {stats.trendingTags.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {stats.trendingTags.map((item, index) => (
                        <Badge
                          key={index}
                          variant="outline"
                          className="border-purple-300 text-purple-700 hover:bg-purple-50"
                        >
                          #{item.tag}
                          <span className="ml-1 text-xs text-gray-500">({item.count})</span>
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 text-center py-4">No tags yet</p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-pink-600" />
                  Recent Search Activity
                </CardTitle>
                <CardDescription>Latest searches in the community</CardDescription>
              </CardHeader>
              <CardContent>
                {stats.recentActivity.length > 0 ? (
                  <div className="space-y-2">
                    {stats.recentActivity.map((item, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <Search className="h-4 w-4 text-gray-400" />
                          <span className="text-sm font-medium">{item.query || "Empty search"}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <span>{item.results_count} results</span>
                          <span>•</span>
                          <span>{new Date(item.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 text-center py-4">No recent activity</p>
                )}
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-500">Failed to load statistics</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

"use client"

import { useEffect, useState } from "react"
import { createSupabaseBrowser } from "@/lib/supabase-browser"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { TrendingUp, Search, Heart, Eye, Tag, Clock, BarChart3, Users, MessageSquare } from "lucide-react"
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
  totalReplies: number
  trendingTags: Array<{ tag: string; count: number }>
  recentActivity: Array<{ query: string; created_at: string; results_count: number }>
  topContributors: Array<{ full_name: string; note_count: number }>
}

interface SearchHistoryRecord {
  query: string
  results_count: number
  created_at: string
}

interface NoteRecord {
  id: string
  view_count: number | null
  user_id: string
}

interface TagRecord {
  tag_title: string | null
  tag_content: string | null
}

interface UserNoteCount {
  user_id: string
  full_name: string | null
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

        // Fetch community notes stats from personal_sticks
        const { data: notes, error: notesError } = await supabase
          .from("personal_sticks")
          .select("id, view_count, user_id")
          .eq("is_shared", true)

        if (notesError) throw notesError

        // Fetch total likes from personal_sticks_reactions
        const { count: likesCount, error: likesError } = await supabase
          .from("personal_sticks_reactions")
          .select("*", { count: "exact", head: true })
          .eq("reaction_type", "like")

        if (likesError) throw likesError

        // Fetch total replies from personal_sticks_replies
        const { count: repliesCount, error: repliesError } = await supabase
          .from("personal_sticks_replies")
          .select("*", { count: "exact", head: true })

        if (repliesError) throw repliesError

        // Fetch trending tags from personal_sticks_tags
        const { data: tags, error: tagsError } = await supabase
          .from("personal_sticks_tags")
          .select("tag_title, tag_content")
          .limit(500)

        if (tagsError) throw tagsError

        // Process tags
        const tagMap = new Map<string, number>()
        const typedTags = (tags || []) as TagRecord[]
        typedTags.forEach((tag) => {
          const tagValue = tag.tag_title || tag.tag_content
          if (tagValue) {
            tagMap.set(tagValue, (tagMap.get(tagValue) || 0) + 1)
          }
        })
        const trendingTags = Array.from(tagMap.entries())
          .map(([tag, count]) => ({ tag, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 8)

        // Calculate top contributors
        const typedNotes = (notes || []) as NoteRecord[]
        const contributorMap = new Map<string, number>()
        typedNotes.forEach((note) => {
          if (note.user_id) {
            contributorMap.set(note.user_id, (contributorMap.get(note.user_id) || 0) + 1)
          }
        })

        // Fetch user names for top contributors
        const topContributorIds = Array.from(contributorMap.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([id]) => id)

        let topContributors: Array<{ full_name: string; note_count: number }> = []
        if (topContributorIds.length > 0) {
          const { data: users } = await supabase.from("users").select("id, full_name").in("id", topContributorIds)

          if (users) {
            topContributors = topContributorIds.map((id) => {
              const user = users.find((u: { id: string; full_name: string | null }) => u.id === id)
              return {
                full_name: user?.full_name || "Anonymous",
                note_count: contributorMap.get(id) || 0,
              }
            })
          }
        }

        setStats({
          totalSearches: typedSearchHistory.length,
          totalResults: typedSearchHistory.reduce((sum, s) => sum + (s.results_count || 0), 0),
          popularQueries,
          totalNotes: typedNotes.length,
          totalLikes: likesCount || 0,
          totalViews: typedNotes.reduce((sum, n) => sum + (n.view_count || 0), 0),
          totalReplies: repliesCount || 0,
          trendingTags,
          recentActivity: typedSearchHistory.slice(0, 5),
          topContributors,
        })
      } catch (error) {
        console.error("Error fetching stats:", error)
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
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <Card key={i}>
                  <CardHeader className="pb-2">
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
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="border-indigo-200 bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-950/30 dark:to-background">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Search className="h-4 w-4 text-indigo-600" />
                    Searches
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-indigo-600">{stats.totalSearches}</div>
                  <p className="text-xs text-muted-foreground mt-1">{stats.totalResults} results found</p>
                </CardContent>
              </Card>

              <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-white dark:from-purple-950/30 dark:to-background">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Heart className="h-4 w-4 text-purple-600" />
                    Likes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-purple-600">{stats.totalLikes}</div>
                  <p className="text-xs text-muted-foreground mt-1">On {stats.totalNotes} shared sticks</p>
                </CardContent>
              </Card>

              <Card className="border-pink-200 bg-gradient-to-br from-pink-50 to-white dark:from-pink-950/30 dark:to-background">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Eye className="h-4 w-4 text-pink-600" />
                    Views
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-pink-600">{stats.totalViews}</div>
                  <p className="text-xs text-muted-foreground mt-1">Community engagement</p>
                </CardContent>
              </Card>

              <Card className="border-cyan-200 bg-gradient-to-br from-cyan-50 to-white dark:from-cyan-950/30 dark:to-background">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-cyan-600" />
                    Replies
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-cyan-600">{stats.totalReplies}</div>
                  <p className="text-xs text-muted-foreground mt-1">Conversations started</p>
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
                            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 text-xs font-bold">
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
                    <p className="text-sm text-muted-foreground text-center py-4">No search data yet</p>
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
                          className="border-purple-300 text-purple-700 dark:border-purple-700 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/50"
                        >
                          #{item.tag}
                          <span className="ml-1 text-xs text-muted-foreground">({item.count})</span>
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">No tags yet</p>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Top Contributors */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-cyan-600" />
                    Top Contributors
                  </CardTitle>
                  <CardDescription>Most active community members</CardDescription>
                </CardHeader>
                <CardContent>
                  {stats.topContributors.length > 0 ? (
                    <div className="space-y-3">
                      {stats.topContributors.map((contributor, index) => (
                        <div key={index} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-cyan-100 dark:bg-cyan-900/50 text-cyan-600 text-xs font-bold">
                              {index + 1}
                            </span>
                            <span className="text-sm font-medium truncate max-w-[180px]">{contributor.full_name}</span>
                          </div>
                          <Badge variant="secondary" className="text-xs">
                            {contributor.note_count} {contributor.note_count === 1 ? "stick" : "sticks"}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">No contributors yet</p>
                  )}
                </CardContent>
              </Card>

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
                          className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <Search className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium truncate max-w-[150px]">
                              {item.query || "Empty search"}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{item.results_count} results</span>
                            <span>•</span>
                            <span>{new Date(item.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">No recent activity</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-muted-foreground">Failed to load statistics</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

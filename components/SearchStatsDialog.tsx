"use client"

import { useEffect, useState } from "react"
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

// Extracted components to reduce nesting depth
function PopularQueryItem({ item, index }: Readonly<{ item: { query: string; count: number }; index: number }>) {
  return (
    <div className="flex items-center justify-between">
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
  )
}

function TrendingTagItem({ item }: Readonly<{ item: { tag: string; count: number } }>) {
  return (
    <Badge
      variant="outline"
      className="border-purple-300 text-purple-700 dark:border-purple-700 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/50"
    >
      #{item.tag}
      <span className="ml-1 text-xs text-muted-foreground">({item.count})</span>
    </Badge>
  )
}

function ContributorItem({ contributor, index }: Readonly<{ contributor: { full_name: string; note_count: number }; index: number }>) {
  return (
    <div className="flex items-center justify-between">
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
  )
}

function RecentActivityItem({ item }: Readonly<{ item: { query: string; created_at: string; results_count: number } }>) {
  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors">
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
  )
}

function LoadingSkeletonItem({ i }: Readonly<{ i: number }>) {
  return (
    <Card key={i}>
      <CardHeader className="pb-2">
        <Skeleton className="h-4 w-24" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-16" />
      </CardContent>
    </Card>
  )
}

function StatsContent({ stats }: Readonly<{ stats: Stats }>) {
  return (
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
                  <PopularQueryItem key={item.query} item={item} index={index} />
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
                {stats.trendingTags.map((item) => (
                  <TrendingTagItem key={item.tag} item={item} />
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
                  <ContributorItem key={contributor.full_name} contributor={contributor} index={index} />
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
                {stats.recentActivity.map((item) => (
                  <RecentActivityItem key={`${item.query}-${item.created_at}`} item={item} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No recent activity</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export function SearchStatsDialog({ open, onOpenChange, userId }: Readonly<SearchStatsDialogProps>) {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchStats() {
      if (!open || !userId) return

      setLoading(true)
      try {
        const response = await fetch("/api/search-stats")
        if (!response.ok) {
          throw new Error("Failed to fetch stats")
        }

        const data = await response.json()
        setStats(data.stats)
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

        {loading && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                // eslint-disable-next-line react/no-array-index-key -- fungible loading skeletons
                <LoadingSkeletonItem key={i} i={i} />
              ))}
            </div>
            <Skeleton className="h-64 w-full" />
          </div>
        )}
        {!loading && stats && <StatsContent stats={stats} />}
        {!loading && !stats && (
          <div className="text-center py-8">
            <p className="text-muted-foreground">Failed to load statistics</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

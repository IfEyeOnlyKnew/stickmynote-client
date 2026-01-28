import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { TrendingUp, Award } from "lucide-react"
import type { AnalyticsData } from "@/hooks/use-analytics"

interface StreakTrackerProps {
  readonly analytics: AnalyticsData
}

export function StreakTracker({ analytics }: StreakTrackerProps) {
  return (
    <Card className="panel-card-enhanced border-0 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <div className="metric-icon bg-gradient-to-br from-green-100 to-emerald-100">
            <TrendingUp className="h-5 w-5 text-green-600" />
          </div>
          Performance Insights
        </CardTitle>
        <CardDescription className="text-gray-600">Key metrics and achievements</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border border-blue-200">
            <div className="text-3xl font-bold text-blue-600">{analytics.averageNotesPerDay}</div>
            <div className="text-xs font-medium text-blue-600 mt-1">Notes/Day</div>
          </div>
          <div className="text-center p-4 bg-gradient-to-br from-green-50 to-emerald-100 rounded-xl border border-green-200">
            <div className="text-3xl font-bold text-green-600">{analytics.currentStreak}</div>
            <div className="text-xs font-medium text-green-600 mt-1">Day Streak</div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <span className="text-sm font-medium text-gray-700">Most Active Day</span>
            <Badge className="bg-purple-100 text-purple-700 border-purple-200 hover:bg-purple-200">
              {analytics.mostActiveDay}
            </Badge>
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <span className="text-sm font-medium text-gray-700">Longest Streak</span>
            <Badge className="gap-1 bg-yellow-100 text-yellow-700 border-yellow-200 hover:bg-yellow-200">
              <Award className="h-3 w-3" />
              {analytics.longestStreak} days
            </Badge>
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <span className="text-sm font-medium text-gray-700">Engagement Rate</span>
            <Badge className="bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200">
              {analytics.totalNotes > 0 ? Math.round((analytics.totalReplies / analytics.totalNotes) * 100) : 0}%
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Target, Award } from "lucide-react"
import type { AnalyticsData } from "@/hooks/use-analytics"

interface NoteStatisticsProps {
  analytics: AnalyticsData
}

export function NoteStatistics({ analytics }: NoteStatisticsProps) {
  return (
    <Card className="panel-card-enhanced border-0 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <div className="metric-icon bg-gradient-to-br from-yellow-100 to-orange-100">
            <Target className="h-5 w-5 text-orange-600" />
          </div>
          Goals & Achievements
        </CardTitle>
        <CardDescription className="text-gray-600">Track your progress and unlock achievements</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="achievement-badge p-5 border-2 border-yellow-200 rounded-xl bg-gradient-to-br from-yellow-50 to-orange-50 hover:shadow-lg transition-all">
            <div className="flex items-center gap-2 mb-3">
              <Award className="h-5 w-5 text-yellow-600" />
              <span className="font-semibold text-gray-900">Note Creator</span>
            </div>
            <p className="text-sm text-gray-700 mb-3 leading-relaxed">Create your first 10 notes</p>
            <Progress
              value={Math.min((analytics.totalNotes / 10) * 100, 100)}
              className="h-2.5 progress-bar-animated"
            />
            <p className="text-xs font-medium text-gray-600 mt-2">{analytics.totalNotes}/10 notes</p>
          </div>

          <div className="achievement-badge p-5 border-2 border-blue-200 rounded-xl bg-gradient-to-br from-blue-50 to-cyan-50 hover:shadow-lg transition-all">
            <div className="flex items-center gap-2 mb-3">
              <Award className="h-5 w-5 text-blue-600" />
              <span className="font-semibold text-gray-900">Community Member</span>
            </div>
            <p className="text-sm text-gray-700 mb-3 leading-relaxed">Share 5 notes publicly</p>
            <Progress
              value={Math.min((analytics.sharedNotes / 5) * 100, 100)}
              className="h-2.5 progress-bar-animated"
            />
            <p className="text-xs font-medium text-gray-600 mt-2">{analytics.sharedNotes}/5 shared</p>
          </div>

          <div className="achievement-badge p-5 border-2 border-green-200 rounded-xl bg-gradient-to-br from-green-50 to-emerald-50 hover:shadow-lg transition-all">
            <div className="flex items-center gap-2 mb-3">
              <Award className="h-5 w-5 text-green-600" />
              <span className="font-semibold text-gray-900">Consistent Writer</span>
            </div>
            <p className="text-sm text-gray-700 mb-3 leading-relaxed">Maintain a 7-day streak</p>
            <Progress
              value={Math.min((analytics.currentStreak / 7) * 100, 100)}
              className="h-2.5 progress-bar-animated"
            />
            <p className="text-xs font-medium text-gray-600 mt-2">{analytics.currentStreak}/7 days</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

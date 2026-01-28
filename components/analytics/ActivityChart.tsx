import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { BarChart3 } from "lucide-react"
import type { AnalyticsData } from "@/hooks/use-analytics"

interface ActivityChartProps {
  readonly analytics: AnalyticsData
}

export function ActivityChart({ analytics }: ActivityChartProps) {
  return (
    <Card className="panel-card-enhanced border-0 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <div className="metric-icon bg-gradient-to-br from-blue-100 to-purple-100">
            <BarChart3 className="h-5 w-5 text-blue-600" />
          </div>
          Activity Breakdown
        </CardTitle>
        <CardDescription className="text-gray-600">Your note-taking patterns and habits</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <div className="flex justify-between text-sm font-medium">
            <span className="text-gray-700">Shared Notes</span>
            <span className="text-blue-600">
              {analytics.sharedNotes}/{analytics.totalNotes}
            </span>
          </div>
          <Progress
            value={analytics.totalNotes > 0 ? (analytics.sharedNotes / analytics.totalNotes) * 100 : 0}
            className="h-3 progress-bar-animated"
          />
        </div>

        <div className="space-y-3">
          <div className="flex justify-between text-sm font-medium">
            <span className="text-gray-700">Private Notes</span>
            <span className="text-purple-600">
              {analytics.privateNotes}/{analytics.totalNotes}
            </span>
          </div>
          <Progress
            value={analytics.totalNotes > 0 ? (analytics.privateNotes / analytics.totalNotes) * 100 : 0}
            className="h-3 progress-bar-animated"
          />
        </div>

        <div className="space-y-3">
          <div className="flex justify-between text-sm font-medium">
            <span className="text-gray-700">Weekly Goal (10 notes)</span>
            <span className="text-green-600">{analytics.notesThisWeek}/10</span>
          </div>
          <Progress value={Math.min((analytics.notesThisWeek / 10) * 100, 100)} className="h-3 progress-bar-animated" />
        </div>
      </CardContent>
    </Card>
  )
}

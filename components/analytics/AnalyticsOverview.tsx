import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { FileText, Users, Activity, Calendar } from "lucide-react"
import type { AnalyticsData } from "@/hooks/use-analytics"

interface AnalyticsOverviewProps {
  readonly analytics: AnalyticsData
}

export function AnalyticsOverview({ analytics }: AnalyticsOverviewProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <Card className="stat-card panel-card-enhanced border-0 shadow-md hover:shadow-xl transition-all">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-sm font-medium text-gray-600">Total Notes</CardTitle>
          <div className="metric-icon w-12 h-12 bg-gradient-to-br from-indigo-100 to-indigo-200">
            <FileText className="h-5 w-5 text-indigo-600" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-indigo-500 bg-clip-text text-transparent">
            {analytics.totalNotes}
          </div>
          <p className="text-xs text-gray-600 mt-1">{analytics.notesThisMonth} this month</p>
        </CardContent>
      </Card>

      <Card className="stat-card panel-card-enhanced border-0 shadow-md hover:shadow-xl transition-all">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-sm font-medium text-gray-600">Shared Notes</CardTitle>
          <div className="metric-icon w-12 h-12 bg-gradient-to-br from-green-100 to-emerald-200">
            <Users className="h-5 w-5 text-green-600" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-500 bg-clip-text text-transparent">
            {analytics.sharedNotes}
          </div>
          <p className="text-xs text-gray-600 mt-1">
            {analytics.totalNotes > 0 ? Math.round((analytics.sharedNotes / analytics.totalNotes) * 100) : 0}% of total
          </p>
        </CardContent>
      </Card>

      <Card className="stat-card panel-card-enhanced border-0 shadow-md hover:shadow-xl transition-all">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-sm font-medium text-gray-600">Replies</CardTitle>
          <div className="metric-icon w-12 h-12 bg-gradient-to-br from-orange-100 to-orange-200">
            <Activity className="h-5 w-5 text-orange-600" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold bg-gradient-to-r from-orange-600 to-orange-500 bg-clip-text text-transparent">
            {analytics.totalReplies}
          </div>
          <p className="text-xs text-gray-600 mt-1">Community interactions</p>
        </CardContent>
      </Card>

      <Card className="stat-card panel-card-enhanced border-0 shadow-md hover:shadow-xl transition-all">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-sm font-medium text-gray-600">This Week</CardTitle>
          <div className="metric-icon w-12 h-12 bg-gradient-to-br from-cyan-100 to-blue-200">
            <Calendar className="h-5 w-5 text-cyan-600" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold bg-gradient-to-r from-cyan-600 to-blue-500 bg-clip-text text-transparent">
            {analytics.notesThisWeek}
          </div>
          <p className="text-xs text-gray-600 mt-1">Notes created</p>
        </CardContent>
      </Card>
    </div>
  )
}

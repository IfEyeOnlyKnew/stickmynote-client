"use client"

import { Card, CardContent } from "@/components/ui/card"
import { useAnalytics } from "@/hooks/use-analytics"
import { AnalyticsOverview } from "@/components/analytics/AnalyticsOverview"
import { ActivityChart } from "@/components/analytics/ActivityChart"
import { StreakTracker } from "@/components/analytics/StreakTracker"
import { NoteStatistics } from "@/components/analytics/NoteStatistics"

export function AnalyticsPanel() {
  const { analytics, loading } = useAnalytics()

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-8 bg-gray-200 rounded w-1/2"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <AnalyticsOverview analytics={analytics} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ActivityChart analytics={analytics} />

        <StreakTracker analytics={analytics} />
      </div>

      <NoteStatistics analytics={analytics} />
    </div>
  )
}

export default AnalyticsPanel

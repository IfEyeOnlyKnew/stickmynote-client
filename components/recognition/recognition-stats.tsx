"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Star, Heart, Send, Award, Flame, TrendingUp } from "lucide-react"

interface Stats {
  kudos_received: number
  total_points: number
  kudos_given: number
  badges_earned: number
  streaks: Record<string, { current: number; longest: number }>
  today_given: number
  daily_limit: number
}

export function RecognitionStats() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch("/api/recognition/stats")
        const data = await res.json()
        setStats(data)
      } catch {
        // silently fail
      }
      setLoading(false)
    }
    fetchStats()
  }, [])

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map(i => (
          // eslint-disable-next-line react/no-array-index-key -- fungible loading skeletons
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4">
              <div className="h-8 w-8 bg-gray-200 rounded-lg mb-2" />
              <div className="h-6 w-12 bg-gray-200 rounded mb-1" />
              <div className="h-3 w-20 bg-gray-200 rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (!stats) return null

  const givingStreak = stats.streaks?.giving?.current || 0
  const longestStreak = stats.streaks?.giving?.longest || 0

  const statCards = [
    {
      icon: Star,
      label: "Total Points",
      value: stats.total_points,
      color: "text-yellow-500",
      bg: "bg-yellow-50",
    },
    {
      icon: Heart,
      label: "Kudos Received",
      value: stats.kudos_received,
      color: "text-pink-500",
      bg: "bg-pink-50",
    },
    {
      icon: Send,
      label: "Kudos Given",
      value: stats.kudos_given,
      subtitle: `${stats.today_given}/${stats.daily_limit} today`,
      color: "text-blue-500",
      bg: "bg-blue-50",
    },
    {
      icon: Award,
      label: "Badges Earned",
      value: stats.badges_earned,
      color: "text-purple-500",
      bg: "bg-purple-50",
    },
    {
      icon: Flame,
      label: "Current Streak",
      value: givingStreak,
      subtitle: (() => {
        if (givingStreak <= 0) return "Start giving!"
        return `${givingStreak} day${givingStreak === 1 ? "" : "s"}`
      })(),
      color: "text-orange-500",
      bg: "bg-orange-50",
    },
    {
      icon: TrendingUp,
      label: "Longest Streak",
      value: longestStreak,
      subtitle: `${longestStreak} day${longestStreak === 1 ? "" : "s"}`,
      color: "text-green-500",
      bg: "bg-green-50",
    },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {statCards.map(card => {
        const Icon = card.icon
        return (
          <Card key={card.label} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className={`h-9 w-9 ${card.bg} rounded-lg flex items-center justify-center mb-2`}>
                <Icon className={`h-5 w-5 ${card.color}`} />
              </div>
              <div className="text-2xl font-bold text-gray-900">{card.value}</div>
              <div className="text-xs text-gray-500 font-medium">{card.label}</div>
              {card.subtitle && (
                <div className="text-xs text-gray-400 mt-0.5">{card.subtitle}</div>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

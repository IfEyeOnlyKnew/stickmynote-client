"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Trophy, Medal, Award, TrendingUp, Heart, Star } from "lucide-react"
import type { LeaderboardEntry } from "@/types/recognition"

interface LeaderboardProps {
  compact?: boolean
  maxEntries?: number
}

const PERIOD_OPTIONS = [
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "quarter", label: "This Quarter" },
  { value: "all", label: "All Time" },
]

const SORT_OPTIONS = [
  { value: "points", label: "Points", icon: Star },
  { value: "received", label: "Received", icon: Heart },
  { value: "given", label: "Given", icon: TrendingUp },
]

export function Leaderboard({ compact = false, maxEntries }: LeaderboardProps) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState("month")
  const [sortBy, setSortBy] = useState("points")

  useEffect(() => {
    const fetchLeaderboard = async () => {
      setLoading(true)
      try {
        const limit = maxEntries || (compact ? 5 : 25)
        const res = await fetch(`/api/recognition/leaderboard?period=${period}&sortBy=${sortBy}&limit=${limit}`)
        const data = await res.json()
        setEntries(data.leaderboard || [])
      } catch {
        setEntries([])
      }
      setLoading(false)
    }
    fetchLeaderboard()
  }, [period, sortBy, compact, maxEntries])

  const getInitials = (name: string) => {
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
  }

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="h-5 w-5 text-yellow-500" />
    if (rank === 2) return <Medal className="h-5 w-5 text-gray-400" />
    if (rank === 3) return <Medal className="h-5 w-5 text-amber-600" />
    return <span className="text-sm font-bold text-gray-400 w-5 text-center">{rank}</span>
  }

  const getRankBg = (rank: number) => {
    if (rank === 1) return "bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-200"
    if (rank === 2) return "bg-gradient-to-r from-gray-50 to-slate-50 border-gray-200"
    if (rank === 3) return "bg-gradient-to-r from-orange-50 to-amber-50 border-orange-200"
    return "bg-white border-gray-100"
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="flex items-center gap-3 p-3 animate-pulse">
            <div className="h-5 w-5 bg-gray-200 rounded" />
            <div className="h-10 w-10 bg-gray-200 rounded-full" />
            <div className="flex-1 space-y-1">
              <div className="h-4 bg-gray-200 rounded w-1/3" />
              <div className="h-3 bg-gray-200 rounded w-1/4" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div className="text-center py-8">
        <Trophy className="h-10 w-10 mx-auto mb-3 text-gray-300" />
        <h3 className="text-lg font-semibold text-gray-900">No leaderboard data yet</h3>
        <p className="text-sm text-gray-500 mt-1">Start giving kudos to see the leaderboard!</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      {!compact && (
        <div className="flex flex-wrap gap-4">
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {PERIOD_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setPeriod(opt.value)}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  period === opt.value
                    ? "bg-white text-gray-900 font-medium shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {SORT_OPTIONS.map(opt => {
              const Icon = opt.icon
              return (
                <button
                  key={opt.value}
                  onClick={() => setSortBy(opt.value)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors ${
                    sortBy === opt.value
                      ? "bg-white text-gray-900 font-medium shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {opt.label}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Top 3 Podium (non-compact only) */}
      {!compact && entries.length >= 3 && (
        <div className="flex items-end justify-center gap-4 py-6">
          {/* 2nd place */}
          <div className="text-center">
            <Avatar className="h-14 w-14 mx-auto border-4 border-gray-300 shadow-lg">
              <AvatarImage src={entries[1].avatar_url || undefined} />
              <AvatarFallback className="bg-gradient-to-br from-gray-400 to-gray-500 text-white">
                {getInitials(entries[1].full_name)}
              </AvatarFallback>
            </Avatar>
            <div className="mt-2 text-sm font-semibold">{entries[1].full_name}</div>
            <div className="text-xs text-gray-500">{entries[1].total_points} pts</div>
            <div className="mt-1 bg-gray-200 rounded-t-lg h-16 w-20 mx-auto flex items-center justify-center">
              <Medal className="h-6 w-6 text-gray-500" />
            </div>
          </div>

          {/* 1st place */}
          <div className="text-center -mt-4">
            <div className="relative">
              <Avatar className="h-18 w-18 mx-auto border-4 border-yellow-400 shadow-xl h-[72px] w-[72px]">
                <AvatarImage src={entries[0].avatar_url || undefined} />
                <AvatarFallback className="bg-gradient-to-br from-yellow-400 to-amber-500 text-white text-lg">
                  {getInitials(entries[0].full_name)}
                </AvatarFallback>
              </Avatar>
            </div>
            <div className="mt-2 text-base font-bold">{entries[0].full_name}</div>
            <div className="text-sm text-yellow-600 font-semibold">{entries[0].total_points} pts</div>
            <div className="mt-1 bg-yellow-200 rounded-t-lg h-24 w-20 mx-auto flex items-center justify-center">
              <Trophy className="h-8 w-8 text-yellow-600" />
            </div>
          </div>

          {/* 3rd place */}
          <div className="text-center">
            <Avatar className="h-14 w-14 mx-auto border-4 border-amber-500 shadow-lg">
              <AvatarImage src={entries[2].avatar_url || undefined} />
              <AvatarFallback className="bg-gradient-to-br from-amber-500 to-orange-600 text-white">
                {getInitials(entries[2].full_name)}
              </AvatarFallback>
            </Avatar>
            <div className="mt-2 text-sm font-semibold">{entries[2].full_name}</div>
            <div className="text-xs text-gray-500">{entries[2].total_points} pts</div>
            <div className="mt-1 bg-amber-200 rounded-t-lg h-12 w-20 mx-auto flex items-center justify-center">
              <Medal className="h-6 w-6 text-amber-700" />
            </div>
          </div>
        </div>
      )}

      {/* Full list */}
      <div className="space-y-2">
        {entries.map((entry, idx) => (
          <div
            key={entry.user_id}
            className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${getRankBg(idx + 1)}`}
          >
            <div className="w-8 flex justify-center">{getRankIcon(idx + 1)}</div>
            <Avatar className="h-10 w-10">
              <AvatarImage src={entry.avatar_url || undefined} />
              <AvatarFallback className="bg-gradient-to-br from-blue-400 to-purple-500 text-white text-sm">
                {getInitials(entry.full_name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm text-gray-900 truncate">{entry.full_name}</div>
              <div className="flex items-center gap-3 text-xs text-gray-500">
                <span>{entry.kudos_received_count} received</span>
                <span>{entry.kudos_given_count} given</span>
                {entry.badges_earned_count > 0 && (
                  <span className="flex items-center gap-0.5">
                    <Award className="h-3 w-3" /> {entry.badges_earned_count}
                  </span>
                )}
              </div>
            </div>
            <div className="text-right">
              <div className="font-bold text-lg text-gray-900">{entry.total_points}</div>
              <div className="text-xs text-gray-400">points</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Award, Star, Trophy, Crown, Gem, Heart, Gift, Flame, Users, Lightbulb, GraduationCap, Sparkles } from "lucide-react"
import { BADGE_TIERS } from "@/types/recognition"
import type { BadgeAward } from "@/types/recognition"

// Map icon string names to Lucide components
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  award: Award,
  star: Star,
  trophy: Trophy,
  crown: Crown,
  gem: Gem,
  heart: Heart,
  gift: Gift,
  flame: Flame,
  users: Users,
  lightbulb: Lightbulb,
  "graduation-cap": GraduationCap,
  sparkles: Sparkles,
}

interface BadgeDisplayProps {
  userId?: string
  compact?: boolean
  maxDisplay?: number
}

export function BadgeDisplay({ userId, compact = false, maxDisplay }: BadgeDisplayProps) {
  const [badges, setBadges] = useState<BadgeAward[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchBadges = async () => {
      try {
        const params = userId ? `?userId=${userId}` : ""
        const res = await fetch(`/api/recognition/badges${params}`)
        const data = await res.json()
        setBadges(data.badges || [])
      } catch {
        setBadges([])
      }
      setLoading(false)
    }
    fetchBadges()
  }, [userId])

  if (loading) {
    return (
      <div className="flex gap-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-10 w-10 rounded-full bg-gray-200 animate-pulse" />
        ))}
      </div>
    )
  }

  if (badges.length === 0) {
    if (compact) return null
    return (
      <div className="text-center py-6 text-gray-500">
        <Award className="h-8 w-8 mx-auto mb-2 text-gray-300" />
        <p className="text-sm">No badges earned yet</p>
      </div>
    )
  }

  const displayBadges = maxDisplay ? badges.slice(0, maxDisplay) : badges
  const remaining = maxDisplay ? Math.max(0, badges.length - maxDisplay) : 0

  if (compact) {
    return (
      <TooltipProvider>
        <div className="flex items-center gap-1 flex-wrap">
          {displayBadges.map(badge => {
            const Icon = ICON_MAP[badge.badge?.icon || "award"] || Award
            const tier = badge.badge?.tier || "bronze"
            const tierInfo = BADGE_TIERS[tier]

            return (
              <Tooltip key={badge.id}>
                <TooltipTrigger asChild>
                  <div
                    className="h-8 w-8 rounded-full flex items-center justify-center border-2 shadow-sm cursor-help"
                    style={{
                      backgroundColor: tierInfo.bgColor,
                      borderColor: tierInfo.color,
                    }}
                  >
                    <span style={{ color: badge.badge?.color || tierInfo.color }}><Icon className="h-4 w-4" /></span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="text-center">
                    <div className="font-semibold">{badge.badge?.name || badge.badge_id}</div>
                    {badge.badge?.description && (
                      <div className="text-xs text-gray-400 mt-0.5">{badge.badge.description}</div>
                    )}
                    <div className="text-xs mt-1" style={{ color: tierInfo.color }}>{tierInfo.label}</div>
                  </div>
                </TooltipContent>
              </Tooltip>
            )
          })}
          {remaining > 0 && (
            <span className="text-xs text-gray-400 ml-1">+{remaining} more</span>
          )}
        </div>
      </TooltipProvider>
    )
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
      {displayBadges.map(badge => {
        const Icon = ICON_MAP[badge.badge?.icon || "award"] || Award
        const tier = badge.badge?.tier || "bronze"
        const tierInfo = BADGE_TIERS[tier]

        return (
          <Card
            key={badge.id}
            className="text-center hover:shadow-md transition-shadow border-2"
            style={{ borderColor: tierInfo.color + "40" }}
          >
            <CardContent className="p-4">
              <div
                className="h-14 w-14 rounded-full flex items-center justify-center mx-auto mb-2 border-2"
                style={{
                  backgroundColor: tierInfo.bgColor,
                  borderColor: tierInfo.color,
                }}
              >
                <span style={{ color: badge.badge?.color || tierInfo.color }}><Icon className="h-7 w-7" /></span>
              </div>
              <div className="font-semibold text-sm text-gray-900">{badge.badge?.name}</div>
              {badge.badge?.description && (
                <div className="text-xs text-gray-500 mt-0.5 line-clamp-2">{badge.badge.description}</div>
              )}
              <div className="text-xs mt-1 font-medium" style={{ color: tierInfo.color }}>
                {tierInfo.label}
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

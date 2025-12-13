"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Search, Zap } from "lucide-react"
import { UserMenu } from "@/components/user-menu"
import { BreadcrumbNav } from "@/components/breadcrumb-nav"
import { PermissionBasedStickFullscreen } from "@/components/permission-based/PermissionBasedStickFullscreen"
import type { User } from "@supabase/supabase-js"
import type { Stick } from "@/types/pad"

interface QuickStick extends Stick {
  pads: {
    id: string
    name: string
    owner_id: string
  }
}

interface QuickSticksPageClientProps {
  user: User
}

export function QuickSticksPageClient({ user }: QuickSticksPageClientProps) {
  const [sticks, setSticks] = useState<QuickStick[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [selectedStick, setSelectedStick] = useState<QuickStick | null>(null)
  const [isFullscreenOpen, setIsFullscreenOpen] = useState(false)

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery)
    }, 300)

    return () => clearTimeout(timer)
  }, [searchQuery])

  // Fetch QuickSticks
  useEffect(() => {
    async function fetchQuickSticks() {
      try {
        setLoading(true)
        const url = `/api/quicksticks${debouncedSearch ? `?search=${encodeURIComponent(debouncedSearch)}` : ""}`
        const response = await fetch(url)

        if (!response.ok) {
          throw new Error("Failed to fetch QuickSticks")
        }

        const data = await response.json()
        setSticks(data.sticks || [])
      } catch (error) {
        console.error("Error fetching QuickSticks:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchQuickSticks()
  }, [debouncedSearch])

  const handleStickClick = (stick: QuickStick) => {
    setSelectedStick(stick)
    setIsFullscreenOpen(true)
  }

  const handleCloseFullscreen = () => {
    setIsFullscreenOpen(false)
    setSelectedStick(null)
  }

  const handleUpdateStick = (updatedStick: Stick) => {
    setSticks((prevSticks) =>
      prevSticks.map((stick) => {
        if (stick.id === updatedStick.id) {
          return {
            ...updatedStick,
            pads: stick.pads,
          }
        }
        return stick
      }),
    )
  }

  const handleDeleteStick = (stickId: string) => {
    setSticks((prevSticks) => prevSticks.filter((stick) => stick.id !== stickId))
    handleCloseFullscreen()
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Breadcrumb Navigation */}
      <div className="mb-6">
        <BreadcrumbNav
          items={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Paks-Hub", href: "/paks" },
            { label: "QuickSticks", current: true },
          ]}
        />
      </div>

      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
            <Zap className="h-6 w-6 text-yellow-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">QuickSticks</h1>
            <p className="text-gray-600">Quick access to your important sticks</p>
          </div>
        </div>
        <UserMenu />
      </div>

      {/* Search Bar */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            type="text"
            placeholder="Search QuickSticks by topic or content..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      )}

      {/* Empty State */}
      {!loading && sticks.length === 0 && (
        <Card className="text-center py-12">
          <CardContent>
            <Zap className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No QuickSticks Found</h3>
            <p className="text-gray-600">
              {searchQuery
                ? "No sticks match your search. Try a different query."
                : "Mark sticks as QuickSticks to see them here for quick access."}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Sticks Grid */}
      {!loading && sticks.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sticks.map((stick) => (
            <Card
              key={stick.id}
              className="cursor-pointer hover:shadow-lg transition-shadow"
              style={{ borderLeft: `4px solid ${stick.color}` }}
              onClick={() => handleStickClick(stick)}
            >
              <CardHeader>
                <CardTitle className="text-lg line-clamp-2">{stick.topic || "Untitled Stick"}</CardTitle>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="secondary" className="text-xs">
                    {stick.pads.name}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    <Zap className="h-3 w-3 mr-1" />
                    QuickStick
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 line-clamp-3">{stick.content}</p>
                <p className="text-xs text-gray-400 mt-2">Updated {new Date(stick.updated_at).toLocaleDateString()}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Fullscreen Modal Component */}
      {selectedStick && isFullscreenOpen && (
        <PermissionBasedStickFullscreen
          stick={selectedStick}
          permissions={{
            canView: true,
            canEdit: true,
            canAdmin: true,
          }}
          onClose={handleCloseFullscreen}
          onUpdate={handleUpdateStick}
          onDelete={handleDeleteStick}
        />
      )}
    </div>
  )
}

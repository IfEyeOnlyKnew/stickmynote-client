"use client"

import { useState, useEffect } from "react"
import { useUser } from "@/contexts/user-context"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { UserMenu } from "@/components/user-menu"
import { FileText, ArrowLeft, Clock } from "lucide-react"
import { BreadcrumbNav } from "@/components/breadcrumb-nav"

interface SocialStick {
  id: string
  topic: string
  content: string
  social_pad_id: string
  user_id: string
  created_at: string
  color: string
}

export default function MySocialSticksPage() {
  const { user, loading } = useUser()
  const router = useRouter()
  const [sticks, setSticks] = useState<SocialStick[]>([])
  const [loadingSticks, setLoadingSticks] = useState(true)

  useEffect(() => {
    if (!loading && !user) {
      router.push("/auth")
    }
  }, [user, loading, router])

  useEffect(() => {
    if (user) {
      fetchSticks()
    }
  }, [user])

  const fetchSticks = async () => {
    try {
      setLoadingSticks(true)
      const response = await fetch("/api/social-sticks")
      if (response.ok) {
        const data = await response.json()
        // Filter to only show sticks created by the current user
        const userSticks = data.sticks?.filter((stick: SocialStick) => stick.user_id === user?.id) || []
        setSticks(userSticks)
      }
    } catch (error) {
      console.error("Error fetching sticks:", error)
    } finally {
      setLoadingSticks(false)
    }
  }

  if (loading || loadingSticks) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <BreadcrumbNav
            items={[
              { label: "Dashboard", href: "/dashboard" },
              { label: "Social Hub", href: "/social" },
              { label: "My Sticks", current: true },
            ]}
          />
          {/* End of breadcrumb navigation */}
          <div className="flex items-center justify-between mt-4">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => router.push("/social")}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Social Hub
              </Button>
              <h1 className="text-2xl font-bold text-gray-900">My Social Sticks</h1>
            </div>
            <UserMenu />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {sticks.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Social Sticks</h3>
              <p className="text-gray-600 mb-4">You haven't created any social sticks yet</p>
              <Button onClick={() => router.push("/social")}>Go to Social Hub</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sticks.map((stick) => (
              <Card
                key={stick.id}
                className="cursor-pointer hover:shadow-lg transition-shadow"
                style={{ backgroundColor: stick.color }}
                onClick={() => router.push(`/social/sticks/${stick.id}`)}
              >
                <CardHeader>
                  <CardTitle className="text-base line-clamp-1">{stick.topic}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-700 line-clamp-4 mb-4">{stick.content}</p>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Clock className="h-3 w-3" />
                    {new Date(stick.created_at).toLocaleDateString()}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

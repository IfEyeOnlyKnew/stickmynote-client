"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useUser } from "@/contexts/user-context"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { UserMenu } from "@/components/user-menu"
import { FileText, ArrowLeft, Clock, Loader2 } from "lucide-react"
import { BreadcrumbNav } from "@/components/breadcrumb-nav"
import {
  CommunicationPaletteProvider,
  CommunicationModals,
} from "@/components/communication"

interface InferenceStick {
  id: string
  topic: string
  content: string
  social_pad_id: string
  user_id: string
  created_at: string
  color: string
}

const PAGE_SIZE = 20

function StickCardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-3/4" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-16 w-full mb-4" />
        <Skeleton className="h-3 w-32" />
      </CardContent>
    </Card>
  )
}

export default function MyInferenceSticksPage() {
  const { user, loading } = useUser()
  const router = useRouter()
  const [sticks, setSticks] = useState<InferenceStick[]>([])
  const [loadingSticks, setLoadingSticks] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [offset, setOffset] = useState(0)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)

  useEffect(() => {
    if (!loading && !user) {
      router.push("/auth")
    }
  }, [user, loading, router])

  const fetchSticks = useCallback(async (reset = false) => {
    if (!user?.id) return
    const currentOffset = reset ? 0 : offset
    try {
      if (reset) {
        setLoadingSticks(true)
      } else {
        setIsLoadingMore(true)
      }
      const response = await fetch(
        `/api/inference-sticks?userId=${user.id}&limit=${PAGE_SIZE}&offset=${currentOffset}`
      )
      if (response.ok) {
        const data = await response.json()
        const newSticks = data.sticks || []
        if (reset) {
          setSticks(newSticks)
          setOffset(newSticks.length)
        } else {
          setSticks((prev) => [...prev, ...newSticks])
          setOffset(currentOffset + newSticks.length)
        }
        setHasMore(data.hasMore ?? false)
      }
    } catch (error) {
      console.error("Error fetching sticks:", error)
    } finally {
      setLoadingSticks(false)
      setIsLoadingMore(false)
    }
  }, [user?.id, offset])

  useEffect(() => {
    if (user) {
      fetchSticks(true)
    }
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadMore = useCallback(() => {
    if (!isLoadingMore && hasMore) {
      fetchSticks(false)
    }
  }, [isLoadingMore, hasMore, fetchSticks])

  // IntersectionObserver for infinite scroll
  useEffect(() => {
    if (!sentinelRef.current || !hasMore) return
    observerRef.current = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasMore && !isLoadingMore) {
          loadMore()
        }
      },
      { rootMargin: "200px", threshold: 0.1 }
    )
    observerRef.current.observe(sentinelRef.current)
    return () => observerRef.current?.disconnect()
  }, [hasMore, isLoadingMore, loadMore])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  if (!user) return null

  return (
    <CommunicationPaletteProvider>
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <BreadcrumbNav
            items={[
              { label: "Dashboard", href: "/dashboard" },
              { label: "Inference Hub", href: "/inference" },
              { label: "My Sticks", current: true },
            ]}
          />
          {/* End of breadcrumb navigation */}
          <div className="flex items-center justify-between mt-4">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => router.push("/inference")}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Inference Hub
              </Button>
              <h1 className="text-2xl font-bold text-gray-900">My Inference Sticks</h1>
            </div>
            <UserMenu />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {loadingSticks && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
              // eslint-disable-next-line react/no-array-index-key -- fungible loading skeletons
              <StickCardSkeleton key={`skeleton-${n}`} />
            ))}
          </div>
        )}
        {!loadingSticks && sticks.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Inference Sticks</h3>
              <p className="text-gray-600 mb-4">You haven&apos;t created any inference sticks yet</p>
              <Button onClick={() => router.push("/inference")}>Go to Inference Hub</Button>
            </CardContent>
          </Card>
        )}
        {!loadingSticks && sticks.length > 0 && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sticks.map((stick) => (
                <Card
                  key={stick.id}
                  className="cursor-pointer hover:shadow-lg transition-shadow"
                  style={{ backgroundColor: stick.color }}
                  onClick={() => router.push(`/inference/sticks/${stick.id}`)}
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
            {hasMore && <div ref={sentinelRef} className="h-4 w-full" />}
            {isLoadingMore && (
              <div className="flex justify-center py-6">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}
          </>
        )}
      </main>

      {/* Communication Palette Modals */}
      <CommunicationModals />
    </div>
    </CommunicationPaletteProvider>
  )
}

"use client"

import { useState, useEffect } from "react"
import { useUser } from "@/contexts/user-context"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { UserMenu } from "@/components/user-menu"
import { ManageMembersDialog } from "@/components/inference/manage-members-dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { Users, Settings, ArrowLeft } from "lucide-react"
import { BreadcrumbNav } from "@/components/breadcrumb-nav"
import {
  CommunicationPaletteProvider,
  CommunicationModals,
} from "@/components/communication"

interface InferencePad {
  id: string
  name: string
  description: string
  owner_id: string
  created_at: string
  social_pad_members?: Array<{ role: string; user_id: string }>
}

export default function MyInferencePadsPage() {
  const { user, loading } = useUser()
  const router = useRouter()
  const [pads, setPads] = useState<InferencePad[]>([])
  const [loadingPads, setLoadingPads] = useState(true)
  const [selectedPad, setSelectedPad] = useState<InferencePad | null>(null)
  const [manageMembersOpen, setManageMembersOpen] = useState(false)

  useEffect(() => {
    if (!loading && !user) {
      router.push("/auth")
    }
  }, [user, loading, router])

  useEffect(() => {
    if (user) {
      fetchPads()
    }
  }, [user])

  const fetchPads = async () => {
    try {
      setLoadingPads(true)
      const response = await fetch("/api/inference-pads")
      if (response.ok) {
        const data = await response.json()
        setPads(data.pads || [])
      }
    } catch (error) {
      console.error("Error fetching pads:", error)
    } finally {
      setLoadingPads(false)
    }
  }

  const getUserRole = (pad: InferencePad) => {
    if (pad.owner_id === user?.id) return "Owner"
    const member = pad.social_pad_members?.find((m) => m.user_id === user?.id)
    return member?.role || "Member"
  }

  const handleManageMembers = (pad: InferencePad) => {
    setSelectedPad(pad)
    setManageMembersOpen(true)
  }

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
              { label: "My Pads", current: true },
            ]}
          />
          {/* End of breadcrumb navigation */}
          <div className="flex items-center justify-between mt-4">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => router.push("/inference")}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Inference Hub
              </Button>
              <h1 className="text-2xl font-bold text-gray-900">My Inference Pads</h1>
            </div>
            <UserMenu />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {loadingPads ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <Skeleton className="h-6 w-3/4 mb-2" />
                      <Skeleton className="h-4 w-full" />
                    </div>
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-8 w-16" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : pads.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Inference Pads</h3>
              <p className="text-gray-600 mb-4">You haven&apos;t created or joined any inference pads yet</p>
              <Button onClick={() => router.push("/inference")}>Go to Inference Hub</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {pads.map((pad) => (
              <Card key={pad.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg">{pad.name}</CardTitle>
                      {pad.description && (
                        <CardDescription className="mt-1 line-clamp-2">{pad.description}</CardDescription>
                      )}
                    </div>
                    <Badge variant={pad.owner_id === user.id ? "default" : "secondary"}>{getUserRole(pad)}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-500">
                      {pad.social_pad_members?.length || 0} member{pad.social_pad_members?.length === 1 ? "" : "s"}
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => router.push(`/inference?pad=${pad.id}`)}>
                        View
                      </Button>
                      {pad.owner_id === user.id && (
                        <Button variant="ghost" size="sm" onClick={() => handleManageMembers(pad)}>
                          <Settings className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      {selectedPad && (
        <ManageMembersDialog
          open={manageMembersOpen}
          onOpenChange={setManageMembersOpen}
          padId={selectedPad.id}
          padName={selectedPad.name}
        />
      )}

      {/* Communication Palette Modals */}
      <CommunicationModals />
    </div>
    </CommunicationPaletteProvider>
  )
}

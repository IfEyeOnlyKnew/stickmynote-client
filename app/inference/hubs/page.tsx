"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Building2, User, Users, Lock, Globe, Settings, ArrowRight } from "lucide-react"
import { BreadcrumbNav } from "@/components/breadcrumb-nav"
import { useUser } from "@/contexts/user-context"
import { HubSetupModal } from "@/components/inference/hub-setup-modal"

interface InferencePad {
  id: string
  name: string
  description: string | null
  is_public: boolean
  hub_type: "individual" | "organization" | null
  hub_email: string | null
  owner_id: string
  created_at: string
  member_count?: number
  stick_count?: number
  user_role?: "owner" | "admin" | "member"
}

export default function InferenceHubsPage() {
  const router = useRouter()
  const { user, loading: userLoading } = useUser()
  const [pads, setPads] = useState<InferencePad[]>([])
  const [loading, setLoading] = useState(true)
  const [individualModalOpen, setIndividualModalOpen] = useState(false)
  const [organizationModalOpen, setOrganizationModalOpen] = useState(false)

  useEffect(() => {
    if (user) {
      fetchPads()
    }
  }, [user])

  const fetchPads = async () => {
    try {
      const response = await fetch("/api/inference-pads")
      if (response.ok) {
        const data = await response.json()
        setPads(data.pads || [])
      }
    } catch (error) {
      console.error("Error fetching pads:", error)
    } finally {
      setLoading(false)
    }
  }

  if (userLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    )
  }

  if (!user) {
    router.push("/auth")
    return null
  }

  const individualHubs = pads.filter((p) => p.hub_type === "individual")
  const organizationHubs = pads.filter((p) => p.hub_type === "organization")

  const renderHubCards = (hubs: InferencePad[], iconColor: string) => (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
      {hubs.map((pad) => (
        <Card key={pad.id} className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <CardTitle className="text-lg">{pad.name}</CardTitle>
                {pad.description && <CardDescription className="mt-1 line-clamp-2">{pad.description}</CardDescription>}
              </div>
              <Badge variant={pad.user_role === "owner" ? "default" : "secondary"} className="ml-2">
                {pad.user_role}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 text-sm text-gray-600 mb-4">
              <div className="flex items-center">
                <Users className="h-4 w-4 mr-1" />
                {pad.member_count || 0} members
              </div>
              <div className="flex items-center">
                {pad.is_public ? (
                  <>
                    <Globe className="h-4 w-4 mr-1" />
                    Public
                  </>
                ) : (
                  <>
                    <Lock className="h-4 w-4 mr-1" />
                    Private
                  </>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => router.push(`/inference/pads/${pad.id}`)} className="flex-1" variant="outline">
                View Pads
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
              {(pad.user_role === "owner" || pad.user_role === "admin") && (
                <Button onClick={() => router.push(`/inference/pads/${pad.id}/edit`)} variant="ghost" size="icon">
                  <Settings className="h-4 w-4" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <BreadcrumbNav
          items={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Inference", href: "/inference" },
            { label: "Inference Hubs", current: true },
          ]}
        />

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Inference Hubs</h1>
          <p className="text-gray-600 text-lg">Manage your Individual and Organization Inference Hubs</p>
        </div>

        <Tabs defaultValue="individual" className="w-full">
          <TabsList className="grid w-full max-w-md mx-auto mb-6 grid-cols-2">
            <TabsTrigger value="individual" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Individual
            </TabsTrigger>
            <TabsTrigger value="organizational" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Organizational
            </TabsTrigger>
          </TabsList>

          {/* Individual Hubs Tab */}
          <TabsContent value="individual" className="space-y-6">
            {individualHubs.length > 0 ? (
              <>
                {/* Create button shown above the list when hubs exist */}
                <div className="flex justify-end">
                  <Button onClick={() => setIndividualModalOpen(true)} className="bg-blue-600 hover:bg-blue-700">
                    <User className="h-4 w-4 mr-2" />
                    Create Individual Hub
                  </Button>
                </div>
                {renderHubCards(individualHubs, "text-blue-600")}
              </>
            ) : (
              <Card className="text-center py-12">
                <CardContent>
                  <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                    <User className="h-8 w-8 text-blue-600" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">No Individual Hubs Yet</h3>
                  <p className="text-gray-600 mb-6">
                    Create your first Individual Hub for personal projects and content
                  </p>
                  <Button
                    onClick={() => setIndividualModalOpen(true)}
                    size="lg"
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <User className="h-4 w-4 mr-2" />
                    Create Individual Hub
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Organizational Hubs Tab */}
          <TabsContent value="organizational" className="space-y-6">
            {organizationHubs.length > 0 ? (
              <>
                {/* Create button shown above the list when hubs exist */}
                <div className="flex justify-end">
                  <Button onClick={() => setOrganizationModalOpen(true)} className="bg-purple-600 hover:bg-purple-700">
                    <Building2 className="h-4 w-4 mr-2" />
                    Create Organizational Hub
                  </Button>
                </div>
                {renderHubCards(organizationHubs, "text-purple-600")}
              </>
            ) : (
              <Card className="text-center py-12">
                <CardContent>
                  <div className="mx-auto w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mb-4">
                    <Building2 className="h-8 w-8 text-purple-600" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">No Organizational Hubs Yet</h3>
                  <p className="text-gray-600 mb-6">Create your first Organizational Hub for team collaboration</p>
                  <Button
                    onClick={() => setOrganizationModalOpen(true)}
                    size="lg"
                    className="bg-purple-600 hover:bg-purple-700"
                  >
                    <Building2 className="h-4 w-4 mr-2" />
                    Create Organizational Hub
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <HubSetupModal open={individualModalOpen} onOpenChange={setIndividualModalOpen} hubType="individual" />
      <HubSetupModal open={organizationModalOpen} onOpenChange={setOrganizationModalOpen} hubType="organization" />
    </div>
  )
}

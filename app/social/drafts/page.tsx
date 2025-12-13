"use client"

import { useState, useEffect } from "react"
import { useUser } from "@/contexts/user-context"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { UserMenu } from "@/components/user-menu"
import { BreadcrumbNav } from "@/components/breadcrumb-nav"
import { DraftStorage, type StickDraft } from "@/lib/draft-storage"
import { FileText, Trash2, Clock, AlertCircle } from "lucide-react"
import { formatDistanceToNow } from "date-fns"

export default function DraftsPage() {
  const { user, loading } = useUser()
  const router = useRouter()
  const [drafts, setDrafts] = useState<StickDraft[]>([])
  const [loadingDrafts, setLoadingDrafts] = useState(true)

  useEffect(() => {
    if (!loading && !user) {
      router.push("/auth")
      return
    }

    if (user) {
      loadDrafts()
    }
  }, [user, loading, router])

  const loadDrafts = () => {
    setLoadingDrafts(true)
    const allDrafts = DraftStorage.getAllDrafts()
    setDrafts(allDrafts)
    setLoadingDrafts(false)
  }

  const handleDeleteDraft = (draftId: string) => {
    if (confirm("Are you sure you want to delete this draft?")) {
      DraftStorage.deleteDraft(draftId)
      loadDrafts()
    }
  }

  const handleClearAll = () => {
    if (confirm("Are you sure you want to delete all drafts? This action cannot be undone.")) {
      DraftStorage.clearAllDrafts()
      loadDrafts()
    }
  }

  const handleOpenDraft = (draft: StickDraft) => {
    // Navigate to the pad with draft context
    router.push(`/social/pads/${draft.padId}?draftId=${draft.id}`)
  }

  if (loading || loadingDrafts) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-600 border-t-transparent" />
          <p className="text-purple-600 font-medium">Loading drafts...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-50 backdrop-blur-lg bg-white/80 border-b border-purple-100 shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <BreadcrumbNav
            items={[
              { label: "Dashboard", href: "/dashboard" },
              { label: "Social Hub", href: "/social" },
              { label: "Drafts", current: true },
            ]}
          />
          <div className="flex items-center justify-between mt-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl social-gradient flex items-center justify-center shadow-lg">
                <FileText className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                  My Drafts
                </h1>
                <p className="text-sm text-gray-600">Auto-saved stick drafts</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {drafts.length > 0 && (
                <Button variant="destructive" size="sm" onClick={handleClearAll}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear All
                </Button>
              )}
              <UserMenu />
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {drafts.length === 0 ? (
          <Card className="border-2 border-dashed border-purple-200 bg-white/50 backdrop-blur-sm">
            <CardContent className="py-16 text-center">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-100 to-blue-100 mx-auto mb-6 flex items-center justify-center">
                <FileText className="h-10 w-10 text-purple-600" />
              </div>
              <h3 className="text-2xl font-bold mb-2 bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                No Drafts Found
              </h3>
              <p className="text-gray-600 mb-6 max-w-md mx-auto">
                Your drafts will be automatically saved as you type. Start creating sticks in your pads to see drafts
                here.
              </p>
              <Button onClick={() => router.push("/social")} className="social-gradient text-white">
                Go to Social Hub
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="bg-purple-100 text-purple-700">
                  {drafts.length} {drafts.length === 1 ? "Draft" : "Drafts"}
                </Badge>
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <AlertCircle className="h-4 w-4" />
                  <span>Drafts are stored locally in your browser</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {drafts.map((draft) => (
                <Card
                  key={draft.id}
                  className="cursor-pointer hover:shadow-xl transition-all duration-300 border-2 hover:border-purple-300 bg-white"
                  onClick={() => handleOpenDraft(draft)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base line-clamp-1">{draft.topic || "Untitled Draft"}</CardTitle>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteDraft(draft.id)
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-gray-700 line-clamp-3 leading-relaxed">{draft.content}</p>
                    <div className="flex items-center justify-between pt-2 border-t border-gray-200/50">
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(new Date(draft.lastSaved), { addSuffix: true })}
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {draft.content.length} chars
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

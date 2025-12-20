"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Search, FileText, Lock, Check, Clock } from "lucide-react"
import { useBrowseAllPads } from "@/hooks/use-browse-all-pads"
import { useToast } from "@/hooks/use-toast"

interface BrowseAllPadsModalProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly onPadSelect: (padId: string) => void
}

export function BrowseAllPadsModal({ open, onOpenChange, onPadSelect }: Readonly<BrowseAllPadsModalProps>) {
  const { toast } = useToast()
  const { pads, isLoading, error, refetch } = useBrowseAllPads(open)
  const [searchQuery, setSearchQuery] = useState("")
  const [requestingAccessFor, setRequestingAccessFor] = useState<string | null>(null)
  const [accessMessage, setAccessMessage] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleRequestAccess = async (padId: string) => {
    setIsSubmitting(true)

    try {
      const response = await fetch("/api/pads/request-access", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          padId,
          message: accessMessage,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to request access")
      }

      toast({
        title: "Request Sent",
        description: "Your access request has been sent to the Pad owner and admins.",
      })

      setRequestingAccessFor(null)
      setAccessMessage("")
      refetch()
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to request access",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const filteredPads = pads.filter(
    (pad) =>
      pad.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pad.description?.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Browse All Pads
          </DialogTitle>
          <DialogDescription>Find and access all standalone Pads</DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search Pads..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading && (
            <div className="flex justify-center items-center py-8">
              <p>Loading Pads...</p>
            </div>
          )}
          {!isLoading && error && (
            <div className="text-center py-8">
              <p className="text-red-500">{error}</p>
              <Button variant="outline" size="sm" onClick={refetch} className="mt-2 bg-transparent">
                Retry
              </Button>
            </div>
          )}
          {!isLoading && !error && filteredPads.length > 0 && (
            <div className="grid gap-3 md:grid-cols-2">
              {filteredPads.map((pad) => (
                <Card
                  key={pad.id}
                  className={`hover:shadow-md transition-shadow ${
                    pad.hasAccess ? "border-green-200 cursor-pointer" : "border-gray-200"
                  }`}
                  onClick={() => {
                    if (pad.hasAccess) {
                      onPadSelect(pad.id)
                    }
                  }}
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        {pad.hasAccess && <Check className="h-4 w-4 text-green-600" />}
                        {pad.hasPendingRequest && <Clock className="h-4 w-4 text-yellow-600" />}
                        {!pad.hasAccess && !pad.hasPendingRequest && <Lock className="h-4 w-4 text-gray-400" />}
                        {pad.name}
                      </span>
                      {pad.hasAccess && (
                        <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">{pad.userRole}</span>
                      )}
                    </CardTitle>
                    <CardDescription className="text-sm">{pad.description || "No description"}</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-2">
                    <p className="text-xs text-gray-500">Created {new Date(pad.created_at).toLocaleDateString()}</p>

                    {/* Action buttons */}
                    {pad.hasAccess && (
                      <Button
                        size="sm"
                        className="w-full bg-green-600 hover:bg-green-700"
                        onClick={(e) => {
                          e.stopPropagation()
                          onPadSelect(pad.id)
                        }}
                      >
                        Open Pad
                      </Button>
                    )}
                    {!pad.hasAccess && pad.hasPendingRequest && (
                      <Button size="sm" variant="outline" className="w-full bg-transparent" disabled>
                        <Clock className="h-4 w-4 mr-2" />
                        Pending Request
                      </Button>
                    )}
                    {!pad.hasAccess && !pad.hasPendingRequest && requestingAccessFor === pad.id && (
                      /* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events */
                      <div
                        className="space-y-2"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      >
                        <Textarea
                          placeholder="Optional: Add a message to your request..."
                          value={accessMessage}
                          onChange={(e) => setAccessMessage(e.target.value)}
                          className="min-h-[80px]"
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="flex-1"
                            onClick={() => handleRequestAccess(pad.id)}
                            disabled={isSubmitting}
                          >
                            {isSubmitting ? "Sending..." : "Send Request"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setRequestingAccessFor(null)
                              setAccessMessage("")
                            }}
                            disabled={isSubmitting}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}
                    {!pad.hasAccess && !pad.hasPendingRequest && requestingAccessFor !== pad.id && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full bg-transparent"
                        onClick={(e) => {
                          e.stopPropagation()
                          setRequestingAccessFor(pad.id)
                        }}
                      >
                        <Lock className="h-4 w-4 mr-2" />
                        Request Access
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
          {!isLoading && !error && filteredPads.length === 0 && (
            <div className="text-center py-8">
              <p className="text-gray-500">
                {searchQuery ? `No Pads found matching "${searchQuery}"` : "No Pads found"}
              </p>
              {searchQuery && (
                <Button variant="outline" size="sm" onClick={() => setSearchQuery("")} className="mt-2">
                  Clear Search
                </Button>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useToast } from "@/hooks/use-toast"
import { Check, X, Clock, Loader2, UserPlus } from "lucide-react"
import { formatDistanceToNow } from "date-fns"

interface AccessRequest {
  id: string
  email: string
  reason: string | null
  status: "pending" | "approved" | "rejected"
  created_at: string
  reviewed_at: string | null
  reviewed_by: string | null
}

interface AccessRequestsPanelProps {
  organizationId: string
}

export function AccessRequestsPanel({ organizationId }: Readonly<AccessRequestsPanelProps>) {
  const [requests, setRequests] = useState<AccessRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean
    requestId: string
    action: "approve" | "reject"
    email: string
  } | null>(null)
  const { toast } = useToast()

  const fetchRequests = useCallback(async () => {
    try {
      const response = await fetch(`/api/organizations/${organizationId}/access-requests`)
      if (response.ok) {
        const data = await response.json()
        setRequests(data.requests || [])
      }
    } catch (error) {
      console.error("Failed to fetch access requests:", error)
    } finally {
      setLoading(false)
    }
  }, [organizationId])

  useEffect(() => {
    fetchRequests()
  }, [fetchRequests])

  const handleAction = async (requestId: string, action: "approve" | "reject") => {
    setProcessingId(requestId)
    try {
      const response = await fetch(`/api/organizations/${organizationId}/access-requests/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || `Failed to ${action} request`)
      }

      toast({
        title: action === "approve" ? "Request Approved" : "Request Rejected",
        description:
          action === "approve"
            ? "The user has been added to the organization and notified."
            : "The request has been rejected.",
      })

      fetchRequests()
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : `Failed to ${action} request`,
        variant: "destructive",
      })
    } finally {
      setProcessingId(null)
      setConfirmDialog(null)
    }
  }

  const pendingRequests = requests.filter((r) => r.status === "pending")
  const processedRequests = requests.filter((r) => r.status !== "pending")

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Access Requests
          </CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Access Requests
            {pendingRequests.length > 0 && <Badge variant="secondary">{pendingRequests.length} pending</Badge>}
          </CardTitle>
          <CardDescription>Review and manage access requests from users in your domain</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {pendingRequests.length === 0 && processedRequests.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No access requests yet</p>
          ) : (
            <>
              {pendingRequests.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-muted-foreground">Pending Requests</h4>
                  {pendingRequests.map((request) => (
                    <div key={request.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>{request.email.charAt(0).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium">{request.email}</p>
                          {request.reason && (
                            <p className="text-xs text-muted-foreground line-clamp-1">{request.reason}</p>
                          )}
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setConfirmDialog({
                              open: true,
                              requestId: request.id,
                              action: "reject",
                              email: request.email,
                            })
                          }
                          disabled={processingId === request.id}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          onClick={() =>
                            setConfirmDialog({
                              open: true,
                              requestId: request.id,
                              action: "approve",
                              email: request.email,
                            })
                          }
                          disabled={processingId === request.id}
                        >
                          {processingId === request.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Check className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {processedRequests.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-muted-foreground">Recent Activity</h4>
                  {processedRequests.slice(0, 5).map((request) => (
                    <div
                      key={request.id}
                      className="flex items-center justify-between p-3 border rounded-lg bg-muted/30"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>{request.email.charAt(0).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm">{request.email}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                      <Badge variant={request.status === "approved" ? "default" : "destructive"}>
                        {request.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={confirmDialog?.open || false} onOpenChange={(open) => !open && setConfirmDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmDialog?.action === "approve" ? "Approve Access Request" : "Reject Access Request"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDialog?.action === "approve"
                ? `This will add ${confirmDialog?.email} as a member of your organization. They will be able to access the dashboard and collaborative features.`
                : `This will reject the access request from ${confirmDialog?.email}. They will be notified of this decision.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDialog && handleAction(confirmDialog.requestId, confirmDialog.action)}
              className={confirmDialog?.action === "reject" ? "bg-destructive hover:bg-destructive/90" : ""}
            >
              {confirmDialog?.action === "approve" ? "Approve" : "Reject"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

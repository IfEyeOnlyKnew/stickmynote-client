"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, UserPlus, CheckCircle, XCircle } from "lucide-react"
import type { OrganizationAccessRequest } from "@/types/organization"

interface RequestsTabProps {
  accessRequests: OrganizationAccessRequest[]
  loadingRequests: boolean
  processingRequest: string | null
  currentOrgRole: string | null
  handleAccessRequest: (requestId: string, action: "approve" | "reject", role?: string) => void
}

export function RequestsTab({
  accessRequests,
  loadingRequests,
  processingRequest,
  currentOrgRole,
  handleAccessRequest,
}: Readonly<RequestsTabProps>) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="h-5 w-5" />
          Access Requests ({accessRequests.length})
        </CardTitle>
        <CardDescription>
          Users from the same domain who want to join your organization. Review and approve or reject their
          requests.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loadingRequests && (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        )}
        {!loadingRequests && accessRequests.length === 0 && (
          <p className="text-center text-gray-500 py-8">No pending access requests</p>
        )}
        {!loadingRequests && accessRequests.length > 0 && (
          <div className="space-y-4">
            {accessRequests.map((request) => (
              <RequestItem
                key={request.id}
                request={request}
                processingRequest={processingRequest}
                currentOrgRole={currentOrgRole}
                handleAccessRequest={handleAccessRequest}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

interface RequestItemProps {
  request: OrganizationAccessRequest
  processingRequest: string | null
  currentOrgRole: string | null
  handleAccessRequest: (requestId: string, action: "approve" | "reject", role?: string) => void
}

function RequestItem({ request, processingRequest, currentOrgRole, handleAccessRequest }: Readonly<RequestItemProps>) {
  return (
    <div className="flex items-center justify-between p-4 bg-yellow-50 rounded-lg border border-yellow-200">
      <div className="flex items-center gap-3">
        <Avatar className="h-10 w-10">
          <AvatarImage src={request.user?.avatar_url || "/placeholder.svg"} />
          <AvatarFallback className="bg-yellow-200 text-yellow-700">
            {request.email.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div>
          <p className="font-medium text-gray-900">{request.full_name || request.email}</p>
          <p className="text-sm text-gray-500">{request.email}</p>
          {request.request_message && (
            <p className="text-sm text-gray-600 mt-1 italic">
              &quot;{request.request_message}&quot;
            </p>
          )}
          <p className="text-xs text-gray-400 mt-1">
            Requested {new Date(request.created_at).toLocaleDateString()}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Select
          defaultValue="member"
          onValueChange={(role) => handleAccessRequest(request.id, "approve", role)}
          disabled={processingRequest === request.id}
        >
          <SelectTrigger className="w-28">
            <SelectValue placeholder="Role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="viewer">Viewer</SelectItem>
            <SelectItem value="member">Member</SelectItem>
            {currentOrgRole === "owner" && <SelectItem value="admin">Admin</SelectItem>}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          onClick={() => handleAccessRequest(request.id, "approve")}
          disabled={processingRequest === request.id}
          className="bg-green-600 hover:bg-green-700"
        >
          {processingRequest === request.id ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle className="h-4 w-4" />
          )}
        </Button>
        <Button
          size="sm"
          variant="destructive"
          onClick={() => handleAccessRequest(request.id, "reject")}
          disabled={processingRequest === request.id}
        >
          <XCircle className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

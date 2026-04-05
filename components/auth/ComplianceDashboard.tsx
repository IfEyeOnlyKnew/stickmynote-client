"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, CheckCircle, AlertTriangle, XCircle, ShieldCheck } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface ComplianceUser {
  userId: string
  email: string
  fullName: string | null
  role: string
  has2FA: boolean
  gracePeriodEnds: string | null
  daysRemaining: number | null
  status: "compliant" | "grace_period" | "non_compliant"
}

interface ComplianceDashboardProps {
  orgId: string
}

export function ComplianceDashboard({ orgId }: Readonly<ComplianceDashboardProps>) {
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState<ComplianceUser[]>([])
  const [policyEnabled, setPolicyEnabled] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchCompliance()
  }, [orgId])

  const fetchCompliance = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/organizations/${orgId}/2fa-compliance`)
      if (response.ok) {
        const data = await response.json()
        setUsers(data.users || [])
        setPolicyEnabled(data.policyEnabled || false)
      } else {
        const errorData = await response.json()
        setError(errorData.error || "Failed to load compliance data")
      }
    } catch (err) {
      console.error("Failed to fetch compliance:", err)
      setError("Failed to load compliance data")
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (user: ComplianceUser) => {
    if (user.status === "compliant") {
      return (
        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
          <CheckCircle className="h-3 w-3 mr-1" />
          Compliant
        </Badge>
      )
    }
    if (user.status === "grace_period") {
      return (
        <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">
          <AlertTriangle className="h-3 w-3 mr-1" />
          Grace Period ({user.daysRemaining}d left)
        </Badge>
      )
    }
    return (
      <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300">
        <XCircle className="h-3 w-3 mr-1" />
        Non-Compliant
      </Badge>
    )
  }

  const getRoleBadge = (role: string) => {
    if (role === "owner") {
      return <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300">Owner</Badge>
    }
    if (role === "admin") {
      return <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300">Admin</Badge>
    }
    return <Badge variant="outline" className="bg-gray-100 text-gray-800 border-gray-300">Member</Badge>
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center text-red-600">
            <XCircle className="h-8 w-8 mx-auto mb-2" />
            <p>{error}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const nonCompliantUsers = users.filter((u) => u.status === "non_compliant")
  const gracePeriodUsers = users.filter((u) => u.status === "grace_period")
  const compliantUsers = users.filter((u) => u.status === "compliant")

  return (
    <Card>
      <CardHeader>
        <CardTitle>2FA Compliance Status</CardTitle>
        <CardDescription>
          Users who need to enable two-factor authentication. Only users in scope of the policy are shown.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {policyEnabled && users.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle className="h-12 w-12 mx-auto mb-3 text-green-500" />
              <p className="font-medium">All users are compliant!</p>
              <p className="text-sm">Everyone in scope has enabled two-factor authentication.</p>
            </div>
        )}
        {policyEnabled && users.length > 0 && (
            <>
              {/* Summary */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="text-center p-4 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-800">
                <p className="text-2xl font-bold text-red-700 dark:text-red-300">{nonCompliantUsers.length}</p>
                <p className="text-sm text-red-600 dark:text-red-400">Non-Compliant</p>
              </div>
              <div className="text-center p-4 bg-yellow-50 dark:bg-yellow-950/30 rounded-lg border border-yellow-200 dark:border-yellow-800">
                <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-300">
                  {gracePeriodUsers.length}
                </p>
                <p className="text-sm text-yellow-600 dark:text-yellow-400">In Grace Period</p>
              </div>
              <div className="text-center p-4 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800">
                <p className="text-2xl font-bold text-green-700 dark:text-green-300">{compliantUsers.length}</p>
                <p className="text-sm text-green-600 dark:text-green-400">Compliant</p>
              </div>
            </div>

            {/* User List */}
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>2FA Enabled</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.userId}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{user.fullName || "Unknown"}</p>
                          <p className="text-sm text-muted-foreground">{user.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>{getRoleBadge(user.role)}</TableCell>
                      <TableCell>{getStatusBadge(user)}</TableCell>
                      <TableCell>
                        {user.has2FA ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-600" />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
        {!policyEnabled && (
          <div className="text-center py-8 text-muted-foreground">
            <ShieldCheck className="h-12 w-12 mx-auto mb-3 text-gray-400" />
            <p className="font-medium">2FA Policy Not Enabled</p>
            <p className="text-sm">Enable the 2FA policy in Org Settings to track compliance.</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

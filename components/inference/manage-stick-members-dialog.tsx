"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { UserPlus, X, Loader2, Mail, FileText, Info } from "lucide-react"
import { CsvEmailUpload } from "@/components/csv-email-upload"

const ROLE_OPTIONS = [
  { value: "viewer", label: "Viewer", description: "Can only view and reply to sticks" },
  { value: "contributor", label: "Contributor", description: "Can create sticks and reply" },
  { value: "editor", label: "Editor", description: "Can create, edit, and reply to all sticks" },
  { value: "moderator", label: "Moderator", description: "Can manage content and pin sticks" },
  { value: "admin", label: "Admin", description: "Full access to all features" },
]

interface StickMember {
  id: string
  user_id: string
  role: string
  granted_at: string
  users?: {
    id: string
    email: string
    full_name: string | null
    username: string | null
    avatar_url: string | null
  }
}

interface ManageStickMembersDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  stickId: string
  stickTopic: string
  padId: string
}

export function ManageStickMembersDialog({
  open,
  onOpenChange,
  stickId,
  stickTopic,
  padId,
}: ManageStickMembersDialogProps) {
  const [members, setMembers] = useState<StickMember[]>([])
  const [email, setEmail] = useState("")
  const [selectedRole, setSelectedRole] = useState("contributor")
  const [bulkRole, setBulkRole] = useState("contributor")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [activeTab, setActiveTab] = useState("invite")
  const [bulkEmails, setBulkEmails] = useState("")

  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    if (open) {
      fetchMembers()
    }
  }, [open, stickId])
  /* eslint-enable react-hooks/exhaustive-deps */

  const fetchMembers = async () => {
    try {
      const response = await fetch(`/api/inference-sticks/${stickId}/members`)
      if (response.ok) {
        const data = await response.json()
        setMembers(data.members || [])
      }
    } catch (error) {
      console.error("Error fetching stick members:", error)
    }
  }

  const handleAddMember = async () => {
    if (!email.trim()) {
      setError("Email is required")
      return
    }

    setLoading(true)
    setError("")
    setSuccess("")

    try {
      const response = await fetch(`/api/inference-sticks/${stickId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), padId, role: selectedRole }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to add member")
      }

      setSuccess(data.message || "Member added successfully")
      setEmail("")
      fetchMembers()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add member")
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveMember = async (memberId: string) => {
    try {
      const response = await fetch(`/api/inference-sticks/${stickId}/members/${memberId}`, {
        method: "DELETE",
      })

      if (response.ok) {
        fetchMembers()
      }
    } catch (error) {
      console.error("Error removing member:", error)
    }
  }

  const handleCsvUpload = async (emails: Array<{ email: string; name?: string }>) => {
    try {
      setLoading(true)
      setError("")
      setSuccess("")
      const emailList = emails.map((e) => e.email)

      const response = await fetch(`/api/inference-sticks/${stickId}/members/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emails: emailList,
          padId,
          role: bulkRole,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setSuccess(data.message || `Successfully processed ${emails.length} email(s)`)
        fetchMembers()
        setActiveTab("invite")
      } else {
        setError(data.error || "Failed to invite members")
      }
    } catch (error) {
      console.error("Error inviting members:", error)
      setError("Failed to invite members")
    } finally {
      setLoading(false)
    }
  }

  const handleBulkInvite = async () => {
    if (!bulkEmails.trim()) return

    const emails = bulkEmails
      .split(/[,;\n]/)
      .map((e) => e.trim())
      .filter((e) => e.length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))

    if (emails.length === 0) {
      setError("No valid emails found. Please check the format.")
      return
    }

    try {
      setLoading(true)
      setError("")
      setSuccess("")

      const response = await fetch(`/api/inference-sticks/${stickId}/members/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emails,
          padId,
          role: bulkRole,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setSuccess(data.message || `Successfully processed ${emails.length} email(s)`)
        setBulkEmails("")
        fetchMembers()
        setActiveTab("invite")
      } else {
        setError(data.error || "Failed to invite members")
      }
    } catch (error) {
      console.error("Error inviting members:", error)
      setError("Failed to invite members")
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateRole = async (memberId: string, newRole: string) => {
    try {
      const response = await fetch(`/api/inference-sticks/${stickId}/members/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      })

      if (response.ok) {
        fetchMembers()
      }
    } catch (error) {
      console.error("Error updating member role:", error)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Stick Members</DialogTitle>
          <DialogDescription>Add or remove members who can access &quot;{stickTopic}&quot;</DialogDescription>
        </DialogHeader>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">{error}</div>}

        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded text-sm">{success}</div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="invite">Invite Members</TabsTrigger>
            <TabsTrigger value="bulk">Bulk Upload</TabsTrigger>
          </TabsList>

          <TabsContent value="invite" className="space-y-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="user@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleAddMember()
                    }
                  }}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">Permission Role</Label>
                <Select value={selectedRole} onValueChange={setSelectedRole}>
                  <SelectTrigger id="role">
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_OPTIONS.map((role) => (
                      <SelectItem key={role.value} value={role.value}>
                        <div className="flex flex-col">
                          <span className="font-medium">{role.label}</span>
                          <span className="text-xs text-muted-foreground">{role.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button onClick={handleAddMember} disabled={loading} className="w-full">
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <UserPlus className="h-4 w-4 mr-2" />}
                Add Member
              </Button>

              <p className="text-xs text-purple-600">
                <Mail className="h-3 w-3 inline mr-1" />
                If the user doesn&apos;t have an account, they&apos;ll receive an email invitation to sign up.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Current Members ({members.length})</Label>
              <div className="border rounded-lg divide-y max-h-[300px] overflow-y-auto">
                {members.length === 0 ? (
                  <div className="p-4 text-center text-gray-500 text-sm">No members yet</div>
                ) : (
                  members.map((member) => (
                    <div key={member.id} className="flex items-center justify-between p-3 hover:bg-gray-50">
                      <div className="flex-1">
                        <p className="font-medium text-sm">
                          {member.users?.full_name || member.users?.username || member.users?.email || "Unknown User"}
                        </p>
                        {member.users?.full_name && <p className="text-xs text-gray-500">{member.users.email}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        <Select value={member.role} onValueChange={(newRole) => handleUpdateRole(member.id, newRole)}>
                          <SelectTrigger className="w-[130px] h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ROLE_OPTIONS.map((role) => (
                              <SelectItem key={role.value} value={role.value}>
                                {role.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveMember(member.id)}
                          className="h-8 w-8 p-0"
                          title="Remove member"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="bulk" className="space-y-4">
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="pt-4">
                <div className="flex gap-3">
                  <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-blue-800">Bulk Upload Requirements</p>
                    <ul className="text-xs text-blue-700 space-y-1">
                      <li>
                        • <strong>Email addresses</strong> are required for each member
                      </li>
                      <li>
                        • <strong>Permission role</strong> will be applied to all uploaded members
                      </li>
                      <li>• CSV files should have email addresses in the first column</li>
                      <li>• Optionally include names in the second column</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-2">
              <Label htmlFor="bulk-role">Permission Role for All Uploaded Members</Label>
              <Select value={bulkRole} onValueChange={setBulkRole}>
                <SelectTrigger id="bulk-role">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((role) => (
                    <SelectItem key={role.value} value={role.value}>
                      <div className="flex flex-col">
                        <span className="font-medium">{role.label}</span>
                        <span className="text-xs text-muted-foreground">{role.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <CsvEmailUpload onEmailsUploaded={handleCsvUpload} />

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileText className="h-5 w-5" />
                  Add Multiple Emails Manually
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="bulk-emails">Email Addresses</Label>
                  <textarea
                    id="bulk-emails"
                    value={bulkEmails}
                    onChange={(e) => setBulkEmails(e.target.value)}
                    placeholder="Enter emails separated by commas, semicolons, or new lines&#10;example@email.com, another@email.com&#10;third@email.com"
                    className="w-full min-h-[120px] p-2 border border-gray-300 rounded-md resize-vertical"
                    rows={5}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Separate emails with commas, semicolons, or new lines. All members will receive the selected
                    permission role above.
                  </p>
                </div>
                <Button onClick={handleBulkInvite} disabled={!bulkEmails.trim() || loading} className="w-full">
                  {loading
                    ? "Inviting..."
                    : `Invite All as ${ROLE_OPTIONS.find((r) => r.value === bulkRole)?.label || "Member"}`}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

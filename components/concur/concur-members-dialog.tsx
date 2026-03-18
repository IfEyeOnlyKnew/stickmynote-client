"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Loader2, Trash2, Upload, Crown } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { LdapUserSearchInput } from "@/components/concur/ldap-user-search-input"

interface GroupMember {
  id: string
  user_id: string
  role: string
  user: {
    id: string
    full_name: string | null
    email: string
    avatar_url: string | null
  } | null
}

interface ConcurMembersDialogProps {
  groupId: string
  onClose: () => void
}

export function ConcurMembersDialog({ groupId, onClose }: ConcurMembersDialogProps) {
  const { toast } = useToast()
  const [members, setMembers] = useState<GroupMember[]>([])
  const [loading, setLoading] = useState(true)
  const [addEmail, setAddEmail] = useState("")
  const [adding, setAdding] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [promotingId, setPromotingId] = useState<string | null>(null)
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)

  const fetchMembers = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/concur/groups/${groupId}/members`)
      if (!res.ok) throw new Error("Failed to fetch")
      const data = await res.json()
      setMembers(data.members || [])
    } catch (error) {
      console.error("Failed to fetch members:", error)
    } finally {
      setLoading(false)
    }
  }, [groupId])

  useEffect(() => {
    fetchMembers()
  }, [fetchMembers])

  const handleAddMemberByEmail = async (email: string) => {
    if (!email.trim()) return
    setAdding(true)
    try {
      const res = await fetch(`/api/concur/groups/${groupId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: data.error || "Failed to add member", variant: "destructive" })
        return
      }
      setMembers((prev) => [...prev, data.member])
      setAddEmail("")
      toast({ title: "Member added" })
    } catch {
      toast({ title: "Failed to add member", variant: "destructive" })
    } finally {
      setAdding(false)
    }
  }

  const handleRemoveMember = async (memberId: string) => {
    setRemovingId(memberId)
    try {
      const res = await fetch(`/api/concur/groups/${groupId}/members/${memberId}`, {
        method: "DELETE",
      })
      if (!res.ok) throw new Error("Failed")
      setMembers((prev) => prev.filter((m) => m.id !== memberId))
      toast({ title: "Member removed" })
    } catch {
      toast({ title: "Failed to remove member", variant: "destructive" })
    } finally {
      setRemovingId(null)
    }
  }

  const handlePromoteToOwner = async (memberId: string) => {
    setPromotingId(memberId)
    try {
      const res = await fetch(`/api/concur/groups/${groupId}/members/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "owner" }),
      })
      if (!res.ok) throw new Error("Failed")
      setMembers((prev) =>
        prev.map((m) => (m.id === memberId ? { ...m, role: "owner" } : m))
      )
      toast({ title: "Member promoted to owner" })
    } catch {
      toast({ title: "Failed to promote member", variant: "destructive" })
    } finally {
      setPromotingId(null)
    }
  }

  const handleCsvImport = async () => {
    if (!csvFile) return
    setImporting(true)
    try {
      const text = await csvFile.text()
      const lines = text.trim().split("\n")
      const csvMembers = lines
        .filter((line) => line.trim())
        .map((line) => {
          const parts = line.split(",").map((p) => p.trim().replace(/(^["'])|(["']$)/g, ""))
          return { email: parts[0] }
        })
        .filter((m) => m.email?.includes("@"))

      const res = await fetch(`/api/concur/groups/${groupId}/members/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ members: csvMembers }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: data.error || "Import failed", variant: "destructive" })
        return
      }

      toast({
        title: `Import complete: ${data.results.added} added, ${data.results.skipped} skipped` +
          (data.results.notFound.length > 0 ? `, ${data.results.notFound.length} not found` : ""),
      })
      setCsvFile(null)
      fetchMembers()
    } catch {
      toast({ title: "Failed to import CSV", variant: "destructive" })
    } finally {
      setImporting(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Group Members</DialogTitle>
          <DialogDescription>
            Manage members of this Concur group. Add individuals or bulk import via CSV.
          </DialogDescription>
        </DialogHeader>

        {/* Add Member */}
        <div className="space-y-3">
          <div className="relative">
            {adding && (
              <div className="absolute inset-0 bg-white/50 z-10 flex items-center justify-center rounded">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            )}
            <LdapUserSearchInput
              value={addEmail}
              placeholder="Search for a member to add..."
              onSelect={(user) => {
                setAddEmail(user.email)
                // Auto-submit when user is selected
                setTimeout(() => {
                  setAddEmail(user.email)
                  handleAddMemberByEmail(user.email)
                }, 0)
              }}
              onChange={() => setAddEmail("")}
              excludeEmails={members.map((m) => m.user?.email || "").filter(Boolean)}
              disabled={adding}
            />
          </div>

          {/* CSV Import */}
          <div className="flex gap-2 items-center">
            <input
              id="csv-upload"
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              aria-label="Upload CSV file"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) setCsvFile(file)
              }}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => document.getElementById("csv-upload")?.click()}
              className="gap-1"
            >
              <Upload className="h-3 w-3" />
              {csvFile ? csvFile.name : "Upload CSV"}
            </Button>
            {csvFile && (
              <Button
                size="sm"
                onClick={handleCsvImport}
                disabled={importing}
                className="gap-1"
              >
                {importing ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                Import
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            CSV format: one email per line, or email,name
          </p>
        </div>

        {/* Members List */}
        <div className="mt-4 space-y-2">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : members.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">No members yet</p>
          ) : (
            members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={member.user?.avatar_url || undefined} />
                    <AvatarFallback className="text-xs">
                      {member.user?.full_name?.[0] || member.user?.email?.[0] || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium flex items-center gap-1">
                      {member.user?.full_name || "Unknown"}
                      {member.role === "owner" && (
                        <Crown className="h-3 w-3 text-yellow-600" />
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">{member.user?.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {member.role !== "owner" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handlePromoteToOwner(member.id)}
                      disabled={promotingId === member.id}
                      title="Promote to owner"
                      className="text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50"
                    >
                      {promotingId === member.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Crown className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveMember(member.id)}
                    disabled={removingId === member.id}
                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                  >
                    {removingId === member.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

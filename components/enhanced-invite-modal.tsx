"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { X, Users, Mail, FileText, Check } from "lucide-react"
import { CsvEmailUpload } from "@/components/csv-email-upload"

interface User {
  id: string
  username: string | null
  email: string | null
  full_name: string | null
}

interface SavedEmail {
  id: string
  email: string
  name?: string
  source: string
}

interface EnhancedInviteModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  teamId: string
  onInviteSubmit: (data: {
    userIds?: string[]
    emails?: string[]
    role: "admin" | "editor" | "viewer"
  }) => Promise<void>
  trigger?: React.ReactNode
}

export function EnhancedInviteModal({ open, onOpenChange, teamId, onInviteSubmit, trigger }: Readonly<EnhancedInviteModalProps>) {
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<User[]>([])
  const [savedEmails, setSavedEmails] = useState<SavedEmail[]>([])
  const [selectedEmails, setSelectedEmails] = useState<string[]>([])
  const [selectedUsers, setSelectedUsers] = useState<User[]>([])
  const [inviteRole, setInviteRole] = useState<"admin" | "editor" | "viewer">("viewer")
  const [isLoading, setIsLoading] = useState(false)
  const [activeTab, setActiveTab] = useState("invite")
  const [manualEmails, setManualEmails] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  // Load saved emails on mount
  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    if (open) {
      loadSavedEmails()
    }
  }, [open, teamId])
  /* eslint-enable react-hooks/exhaustive-deps */

  // Search users and saved emails
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      return
    }

    const searchUsers = async () => {
      try {
        // Search existing users
        const userResponse = await fetch(`/api/user-search?query=${encodeURIComponent(searchQuery)}&teamId=${teamId}`)
        if (userResponse.ok) {
          const users = await userResponse.json()
          setSearchResults(users)
        }
      } catch (err) {
        console.error("Search error:", err)
      }
    }

    const debounce = setTimeout(searchUsers, 300)
    return () => clearTimeout(debounce)
  }, [searchQuery, teamId])

  const loadSavedEmails = async () => {
    try {
      const response = await fetch(`/api/saved-emails?teamId=${teamId}`)

      if (response.ok) {
        const data = await response.json()
        setSavedEmails(data.savedEmails || [])
      }
    } catch (err) {
      // Silent fail - saved emails are optional
    }
  }

  const handleCsvUpload = async (emails: Array<{ email: string; name?: string }>) => {
    try {
      setIsLoading(true)
      await loadSavedEmails()
      setActiveTab("invite")
    } catch (err) {
      // Silent fail
    } finally {
      setIsLoading(false)
    }
  }

  const addManualEmail = async () => {
    if (!manualEmails.trim()) {
      return
    }

    const emails = manualEmails
      .split(/[,;\n]/)
      .map((e) => e.trim())
      .filter((e) => e.length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))
      .map((email) => ({ email }))

    if (emails.length === 0) {
      alert("No valid emails found. Please check the format.")
      return
    }

    try {
      setIsLoading(true)

      const requestBody = {
        emails,
        teamId,
        source: "manual",
      }

      const response = await fetch("/api/saved-emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      })

      const responseText = await response.text()

      if (response.ok) {
        await loadSavedEmails()
        setManualEmails("")
      } else {
        alert(`Failed to save emails: ${responseText}`)
      }
    } catch (err) {
      alert(`Error adding emails: ${err}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleBulkAdd = async () => {
    if (!manualEmails.trim()) {
      return
    }

    const emailList = manualEmails
      .split(/[,;\n]/)
      .map((e) => e.trim())
      .filter((e) => e.length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))

    if (emailList.length === 0) {
      alert("No valid emails found. Please check the format.")
      return
    }

    try {
      setIsLoading(true)

      const requestBody = { emails: emailList }

      const response = await fetch("/api/saved-emails/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      })

      const responseText = await response.text()

      if (response.ok) {
        await loadSavedEmails()
        setManualEmails("")
      } else {
        alert(`Failed to save emails: ${responseText}`)
      }
    } catch (err) {
      alert(`Error adding bulk emails: ${err}`)
    } finally {
      setIsLoading(false)
    }
  }

  const toggleEmailSelection = (email: string) => {
    setSelectedEmails((prev) => (prev.includes(email) ? prev.filter((e) => e !== email) : [...prev, email]))
  }

  const toggleUserSelection = (user: User) => {
    setSelectedUsers((prev) =>
      prev.find((u) => u.id === user.id) ? prev.filter((u) => u.id !== user.id) : [...prev, user],
    )
  }

  const handleSubmit = async () => {
    const userIds = selectedUsers.map((u) => u.id)
    const emails = [...selectedEmails]

    // Add any manually typed emails that aren't in saved emails
    if (searchQuery && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(searchQuery)) {
      const isAlreadySelected = emails.includes(searchQuery) || selectedUsers.some((u) => u.email === searchQuery)
      if (!isAlreadySelected) {
        emails.push(searchQuery)
      }
    }

    if (userIds.length === 0 && emails.length === 0) return

    try {
      setIsLoading(true)
      await onInviteSubmit({
        userIds: userIds.length > 0 ? userIds : undefined,
        emails: emails.length > 0 ? emails : undefined,
        role: inviteRole,
      })

      // Reset form
      setSearchQuery("")
      setSelectedEmails([])
      setSelectedUsers([])
      setSearchResults([])
      onOpenChange(false)
    } catch (err) {
      console.error("Error submitting invites:", err)
    } finally {
      setIsLoading(false)
    }
  }

  const filteredSavedEmails = savedEmails.filter((email) =>
    searchQuery
      ? email.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        email.name?.toLowerCase().includes(searchQuery.toLowerCase())
      : true,
  )

  const totalSelected =
    selectedUsers.length +
    selectedEmails.length +
    (searchQuery &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(searchQuery) &&
    !selectedEmails.includes(searchQuery) &&
    !selectedUsers.some((u) => u.email === searchQuery)
      ? 1
      : 0)

  return (
    <>
      {trigger && <button type="button" className="appearance-none bg-transparent border-none p-0 cursor-pointer" onClick={() => onOpenChange(true)}>{trigger}</button>}

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>{teamId === "global-multipaks" ? "Invite to Multi-Paks" : "Invite to Team"}</DialogTitle>
            <DialogDescription>
              {teamId === "global-multipaks"
                ? "Invite users to access your multi-paks and collaborate with your teams"
                : "Search users, select from saved emails, or add new ones"}
            </DialogDescription>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="invite" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Invite ({totalSelected})
              </TabsTrigger>
              <TabsTrigger value="manage" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Manage Emails
              </TabsTrigger>
            </TabsList>

            <TabsContent value="invite" className="flex-1 overflow-hidden">
              <div className="space-y-4 h-full overflow-auto">
                {/* Search Input */}
                <div>
                  <Label htmlFor="search">Search or type email</Label>
                  <Input
                    ref={inputRef}
                    id="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search users or type email address..."
                    className="w-full"
                  />
                </div>

                {/* Search Results - Users */}
                {searchResults.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Existing Users</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 max-h-32 overflow-auto">
                      {searchResults.map((user) => (
                        <button
                          key={user.id}
                          type="button"
                          className={`p-2 rounded cursor-pointer transition-colors w-full text-left ${
                            selectedUsers.find((u) => u.id === user.id)
                              ? "bg-blue-100 border border-blue-300"
                              : "hover:bg-gray-100 border border-transparent"
                          }`}
                          onClick={() => toggleUserSelection(user)}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-medium text-sm">{user.username || user.email}</div>
                              <div className="text-xs text-gray-500">{user.full_name || "No name"}</div>
                            </div>
                            {selectedUsers.find((u) => u.id === user.id) && <Check className="h-4 w-4 text-blue-600" />}
                          </div>
                        </button>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {/* Saved Emails */}
                {filteredSavedEmails.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Saved Emails</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 max-h-40 overflow-auto">
                      {filteredSavedEmails.map((savedEmail) => (
                        <button
                          key={savedEmail.id}
                          type="button"
                          className={`p-2 rounded cursor-pointer transition-colors w-full text-left ${
                            selectedEmails.includes(savedEmail.email)
                              ? "bg-green-100 border border-green-300"
                              : "hover:bg-gray-100 border border-transparent"
                          }`}
                          onClick={() => toggleEmailSelection(savedEmail.email)}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-medium text-sm">{savedEmail.email}</div>
                              {savedEmail.name && <div className="text-xs text-gray-500">{savedEmail.name}</div>}
                            </div>
                            {selectedEmails.includes(savedEmail.email) && <Check className="h-4 w-4 text-green-600" />}
                          </div>
                        </button>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {/* Manual Email Entry */}
                {searchQuery && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(searchQuery) && (
                  <Card className="border-dashed">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-sm">Add: {searchQuery}</div>
                          <div className="text-xs text-gray-500">New email address</div>
                        </div>
                        <Mail className="h-4 w-4 text-gray-400" />
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Selected Items */}
                {(selectedUsers.length > 0 || selectedEmails.length > 0) && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Selected ({totalSelected})</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex flex-wrap gap-2">
                        {selectedUsers.map((user) => (
                          <Badge key={user.id} variant="secondary" className="flex items-center gap-1">
                            {user.username || user.email}
                            <X className="h-3 w-3 cursor-pointer" onClick={() => toggleUserSelection(user)} />
                          </Badge>
                        ))}
                        {selectedEmails.map((email) => (
                          <Badge key={email} variant="outline" className="flex items-center gap-1">
                            {email}
                            <X className="h-3 w-3 cursor-pointer" onClick={() => toggleEmailSelection(email)} />
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Role Selection */}
                <div>
                  <Label htmlFor="role">Role</Label>
                  <Select
                    value={inviteRole}
                    onValueChange={(value: "admin" | "editor" | "viewer") => setInviteRole(value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="viewer">Viewer</SelectItem>
                      <SelectItem value="editor">Editor</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => onOpenChange(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleSubmit} disabled={totalSelected === 0 || isLoading}>
                    {isLoading && "Sending..."}
                    {!isLoading && `Send ${totalSelected} Invite${totalSelected === 1 ? "" : "s"}`}
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="manage" className="flex-1 overflow-hidden">
              <div className="space-y-4 h-full overflow-auto">
                {/* CSV Upload */}
                <CsvEmailUpload onEmailsUploaded={handleCsvUpload} />

                {/* Manual Email Entry */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Mail className="h-5 w-5" />
                      Add Emails Manually
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="manual-emails">Email Addresses</Label>
                      <textarea
                        id="manual-emails"
                        value={manualEmails}
                        onChange={(e) => setManualEmails(e.target.value)}
                        placeholder="Enter emails separated by commas, semicolons, or new lines&#10;example@email.com, another@email.com&#10;third@email.com"
                        className="w-full min-h-[80px] p-2 border border-gray-300 rounded-md resize-vertical"
                        rows={3}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Separate emails with commas, semicolons, or new lines
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={addManualEmail} disabled={!manualEmails.trim() || isLoading}>
                        {isLoading ? "Adding..." : "Add Emails"}
                      </Button>
                      <Button onClick={handleBulkAdd} variant="outline" disabled={!manualEmails.trim() || isLoading}>
                        {isLoading ? "Adding..." : "Bulk Add"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Saved Emails List */}
                {savedEmails.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Saved Emails ({savedEmails.length})</CardTitle>
                    </CardHeader>
                    <CardContent className="max-h-60 overflow-auto">
                      <div className="space-y-2">
                        {savedEmails.map((email) => (
                          <div key={email.id} className="flex items-center justify-between p-2 border rounded">
                            <div>
                              <div className="font-medium text-sm">{email.email}</div>
                              {email.name && <div className="text-xs text-gray-500">{email.name}</div>}
                              <div className="text-xs text-gray-400">Source: {email.source}</div>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={async () => {
                                try {
                                  const response = await fetch(`/api/saved-emails?id=${email.id}`, { method: "DELETE" })
                                  if (response.ok) {
                                    await loadSavedEmails()
                                  }
                                } catch (err) {
                                  // Silent fail
                                }
                              }}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  )
}

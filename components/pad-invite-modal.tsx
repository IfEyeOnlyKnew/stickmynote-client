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
import { X, Users, Mail, FileText, Check, Shield } from "lucide-react"
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

type PadRole = "admin" | "editor" | "viewer"

interface PadInviteModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  padId: string
  onInviteSubmit: (data: {
    userIds?: string[]
    emails?: string[]
    role: PadRole
  }) => Promise<void>
}

export function PadInviteModal({ open, onOpenChange, padId, onInviteSubmit }: Readonly<PadInviteModalProps>) {
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<User[]>([])
  const [savedEmails, setSavedEmails] = useState<SavedEmail[]>([])
  const [selectedEmails, setSelectedEmails] = useState<string[]>([])
  const [selectedUsers, setSelectedUsers] = useState<User[]>([])
  const [inviteRole, setInviteRole] = useState<PadRole>("viewer")
  const [defaultManageRole, setDefaultManageRole] = useState<PadRole>("viewer")
  const [isLoading, setIsLoading] = useState(false)
  const [activeTab, setActiveTab] = useState("invite")
  const [manualEmails, setManualEmails] = useState("")
  const [padName, setPadName] = useState("Pad")
  const inputRef = useRef<HTMLInputElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) {
      loadPadData()
      loadSavedEmails()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, padId])

  const loadPadData = async () => {
    try {
      const response = await fetch(`/api/pads/${padId}/members`)
      if (response.ok) {
        const data = await response.json()
        setPadName(data.padName || "Pad")
      }
    } catch (err) {
      console.error("Error loading pad data:", err)
    }
  }

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      return
    }

    const searchUsers = async () => {
      try {
        const userResponse = await fetch(`/api/user-search?query=${encodeURIComponent(searchQuery)}&padId=${padId}`)
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
  }, [searchQuery, padId])

  const handleRoleChange = (value: PadRole) => {
    setInviteRole(value)
  }

  const loadSavedEmails = async () => {
    try {
      const response = await fetch(`/api/saved-emails?padId=${padId}`)
      if (response.ok) {
        const data = await response.json()
        setSavedEmails(data.savedEmails || [])
      }
    } catch (err) {
      console.error("Error loading saved emails:", err)
    }
  }

  const handleCsvUpload = async (emails: Array<{ email: string; name?: string }>) => {
    try {
      setIsLoading(true)
      await loadSavedEmails()
      setActiveTab("invite")
    } catch (err) {
      console.error("Error refreshing emails after CSV upload:", err)
    } finally {
      setIsLoading(false)
    }
  }

  const addManualEmail = async () => {
    if (!manualEmails.trim()) return

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
      const response = await fetch("/api/saved-emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emails,
          padId,
          source: "manual",
        }),
      })

      if (response.ok) {
        await loadSavedEmails()
        setManualEmails("")
      } else {
        const errorText = await response.text()
        alert(`Failed to save emails: ${errorText}`)
      }
    } catch (err) {
      alert(`Error adding emails: ${err}`)
    } finally {
      setIsLoading(false)
    }
  }

  const toggleEmailSelection = (email: string) => {
    setSelectedEmails((prev) => (prev.includes(email) ? prev.filter((e) => e !== email) : [...prev, email]))
  }

  const toggleUserSelection = (user: User) => {
    setSelectedUsers((prev) =>
      prev.some((u) => u.id === user.id) ? prev.filter((u) => u.id !== user.id) : [...prev, user],
    )
  }

  const handleSubmit = async () => {
    const userIds = selectedUsers.map((u) => u.id)
    const emails = [...selectedEmails]

    if (searchQuery && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(searchQuery)) {
      const isAlreadySelected = emails.includes(searchQuery) || selectedUsers.some((u) => u.email === searchQuery)
      if (!isAlreadySelected) {
        emails.push(searchQuery)
      }
    }

    if (userIds.length === 0 && emails.length === 0) {
      alert("Please select at least one user or enter an email address")
      return
    }

    const submitData = {
      userIds: userIds.length > 0 ? userIds : undefined,
      emails: emails.length > 0 ? emails : undefined,
      role: inviteRole,
    }

    try {
      setIsLoading(true)
      await onInviteSubmit(submitData)

      setSearchQuery("")
      setSelectedEmails([])
      setSelectedUsers([])
      setSearchResults([])
      await loadPadData()
    } catch (err) {
      console.error("Error submitting invites:", err)
    } finally {
      setIsLoading(false)
    }
  }

  const addTypedEmail = () => {
    if (searchQuery && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(searchQuery)) {
      const isAlreadySelected =
        selectedEmails.includes(searchQuery) || selectedUsers.some((u) => u.email === searchQuery)
      if (!isAlreadySelected) {
        setSelectedEmails((prev) => [...prev, searchQuery])
        setSearchQuery("")
      }
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      addTypedEmail()
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

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        onOpenChange(false)
      }
    }
    if (open) {
      globalThis.addEventListener("keydown", handleEscape)
    }
    return () => globalThis.removeEventListener("keydown", handleEscape)
  }, [open, onOpenChange])

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus()
    }
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[85vh] flex flex-col overflow-hidden" ref={dialogRef}>
        <DialogHeader className="flex-shrink-0 pb-4 border-b">
          <DialogTitle className="text-2xl">Invite Others to {padName}</DialogTitle>
          <DialogDescription>Search users, select from saved emails, or add new ones</DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <TabsList className="grid w-full grid-cols-3 flex-shrink-0 mb-4">
            <TabsTrigger value="invite" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span>Invite ({totalSelected})</span>
            </TabsTrigger>
            <TabsTrigger value="manage" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span>Manage Emails</span>
            </TabsTrigger>
            <TabsTrigger value="upload" className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              <span>Upload CSV</span>
            </TabsTrigger>
          </TabsList>

          {/* INVITE TAB */}
          <TabsContent value="invite" className="flex-1 flex flex-col min-h-0 space-y-4 overflow-hidden">
            <Card className="border-2 border-blue-500 shadow-md flex-shrink-0">
              <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Shield className="h-5 w-5 text-blue-600" />
                  Permission Level
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <Select value={inviteRole} onValueChange={handleRoleChange}>
                  <SelectTrigger className="w-full h-12 text-base border-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">
                      <div className="py-1">
                        <div className="font-semibold">Admin</div>
                        <div className="text-xs text-gray-500">Full control - manage pad, invite others</div>
                      </div>
                    </SelectItem>
                    <SelectItem value="editor">
                      <div className="py-1">
                        <div className="font-semibold">Editor</div>
                        <div className="text-xs text-gray-500">Can create and edit sticks</div>
                      </div>
                    </SelectItem>
                    <SelectItem value="viewer">
                      <div className="py-1">
                        <div className="font-semibold">Viewer</div>
                        <div className="text-xs text-gray-500">Can view sticks and add replies</div>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <div className="mt-3 flex items-center gap-2 text-sm text-gray-700">
                  <Badge className="bg-blue-600">{inviteRole.toUpperCase()}</Badge>
                  <span>will be granted to all invited users</span>
                </div>
              </CardContent>
            </Card>

            <div className="flex-1 overflow-auto pr-2 space-y-4">
              <div>
                <Label htmlFor="search" className="mb-2 block">
                  Search or type email
                </Label>
                <div className="flex gap-2">
                  <Input
                    ref={inputRef}
                    id="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Search users or type email address..."
                    className="flex-1"
                  />
                  {searchQuery && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(searchQuery) && (
                    <Button size="sm" onClick={addTypedEmail} className="px-4">
                      Add
                    </Button>
                  )}
                </div>
              </div>

              {searchResults.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Existing Users</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 max-h-40 overflow-auto">
                    {searchResults.map((user) => (
                      <button
                        key={user.id}
                        type="button"
                        className={`w-full text-left p-2 rounded cursor-pointer transition-colors ${
                          selectedUsers.some((u) => u.id === user.id)
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
                          {selectedUsers.some((u) => u.id === user.id) && <Check className="h-4 w-4 text-blue-600" />}
                        </div>
                      </button>
                    ))}
                  </CardContent>
                </Card>
              )}

              {filteredSavedEmails.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Saved Emails ({filteredSavedEmails.length})</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 max-h-48 overflow-auto">
                    {filteredSavedEmails.map((savedEmail) => (
                      <button
                        key={savedEmail.id}
                        type="button"
                        className={`w-full text-left p-2 rounded cursor-pointer transition-colors ${
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

              {totalSelected > 0 && (
                <Card className="bg-blue-50 border-blue-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Selected ({totalSelected})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
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
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t bg-white flex-shrink-0">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              <Button onClick={handleSubmit} disabled={totalSelected === 0 || isLoading}>
                {isLoading && "Sending..."}
                {!isLoading && `Send ${totalSelected} Invite${totalSelected === 1 ? "" : "s"}`}
              </Button>
            </div>
          </TabsContent>

          {/* MANAGE EMAILS TAB */}
          <TabsContent value="manage" className="flex-1 flex flex-col min-h-0 space-y-4 overflow-hidden">
            <Card className="border-2 border-green-500 shadow-md flex-shrink-0">
              <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Shield className="h-5 w-5 text-green-600" />
                  Default Permission Level
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <Select
                  value={defaultManageRole}
                  onValueChange={(value: PadRole) => setDefaultManageRole(value)}
                >
                  <SelectTrigger className="w-full h-12 text-base border-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">
                      <div className="py-1">
                        <div className="font-semibold">Admin</div>
                        <div className="text-xs text-gray-500">Full control - manage pad, invite others</div>
                      </div>
                    </SelectItem>
                    <SelectItem value="editor">
                      <div className="py-1">
                        <div className="font-semibold">Editor</div>
                        <div className="text-xs text-gray-500">Can create and edit sticks</div>
                      </div>
                    </SelectItem>
                    <SelectItem value="viewer">
                      <div className="py-1">
                        <div className="font-semibold">Viewer</div>
                        <div className="text-xs text-gray-500">Can view sticks and add replies</div>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <div className="mt-3 flex items-center gap-2 text-sm text-gray-700">
                  <Badge className="bg-green-600">{defaultManageRole.toUpperCase()}</Badge>
                  <span>will be applied to all invitations</span>
                </div>
              </CardContent>
            </Card>

            <div className="flex-1 overflow-auto pr-2 space-y-4">
              <CsvEmailUpload onEmailsUploaded={handleCsvUpload} />

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
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
                    <p className="text-xs text-gray-500 mt-1">Separate emails with commas, semicolons, or new lines</p>
                  </div>
                  <Button onClick={addManualEmail} disabled={!manualEmails.trim() || isLoading}>
                    {isLoading ? "Adding..." : "Add Emails"}
                  </Button>
                </CardContent>
              </Card>

              {savedEmails.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Saved Emails ({savedEmails.length})</CardTitle>
                  </CardHeader>
                  <CardContent className="max-h-48 overflow-auto">
                    <div className="space-y-2">
                      {savedEmails.map((savedEmail) => (
                        <button
                          key={savedEmail.id}
                          type="button"
                          className={`w-full text-left p-2 rounded cursor-pointer transition-colors ${
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
                              <Badge variant="outline" className="text-xs mt-1 bg-green-50">
                                Will receive: {defaultManageRole}
                              </Badge>
                            </div>
                            {selectedEmails.includes(savedEmail.email) && <Check className="h-4 w-4 text-green-600" />}
                          </div>
                        </button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t bg-white flex-shrink-0">
              <Button variant="outline" onClick={() => setActiveTab("invite")} className="min-w-[120px]">
                Go to Invite Tab
              </Button>
              <Button
                onClick={async () => {
                  if (selectedEmails.length === 0) {
                    alert("Please select at least one email to send invitations")
                    return
                  }

                  try {
                    setIsLoading(true)
                    await onInviteSubmit({
                      emails: selectedEmails,
                      role: defaultManageRole,
                    })

                    setSelectedEmails([])
                    await loadPadData()
                  } catch (err) {
                    console.error("Error sending invites from manage tab:", err)
                  } finally {
                    setIsLoading(false)
                  }
                }}
                disabled={selectedEmails.length === 0 || isLoading}
                variant="default"
                className="min-w-[140px]"
              >
                {isLoading && "Sending..."}
                {!isLoading && `Send ${selectedEmails.length} Invite${selectedEmails.length === 1 ? "" : "s"}`}
              </Button>
            </div>
          </TabsContent>

          {/* UPLOAD CSV TAB */}
          <TabsContent value="upload" className="flex-1 flex flex-col min-h-0 space-y-4 overflow-hidden">
            <Card className="border-2 border-purple-500 shadow-md flex-shrink-0">
              <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Shield className="h-5 w-5 text-purple-600" />
                  Default Permission Level
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <Select
                  value={defaultManageRole}
                  onValueChange={(value: PadRole) => setDefaultManageRole(value)}
                >
                  <SelectTrigger className="w-full h-12 text-base border-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">
                      <div className="py-1">
                        <div className="font-semibold">Admin</div>
                        <div className="text-xs text-gray-500">Full control - manage everything</div>
                      </div>
                    </SelectItem>
                    <SelectItem value="editor">
                      <div className="py-1">
                        <div className="font-semibold">Editor</div>
                        <div className="text-xs text-gray-500">Can create and edit sticks</div>
                      </div>
                    </SelectItem>
                    <SelectItem value="viewer">
                      <div className="py-1">
                        <div className="font-semibold">Viewer</div>
                        <div className="text-xs text-gray-500">Can view sticks and add replies</div>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <div className="mt-3 flex items-center gap-2 text-sm text-gray-700">
                  <Badge className="bg-purple-600">{defaultManageRole.toUpperCase()}</Badge>
                  <span>will be applied to uploaded users</span>
                </div>
              </CardContent>
            </Card>

            <div className="flex-1 overflow-auto">
              <CsvEmailUpload onEmailsUploaded={handleCsvUpload} />
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

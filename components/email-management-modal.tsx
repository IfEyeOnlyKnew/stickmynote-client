"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Upload, Plus, Trash2, Download, AlertCircle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface SavedEmail {
  id: string
  email: string
  name?: string
  created_at: string
}

interface EmailManagementModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EmailManagementModal({ open, onOpenChange }: Readonly<EmailManagementModalProps>) {
  const [savedEmails, setSavedEmails] = useState<SavedEmail[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [newEmail, setNewEmail] = useState("")
  const [newName, setNewName] = useState("")
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [bulkEmails, setBulkEmails] = useState("")
  const [selectedEmails, setSelectedEmails] = useState<string[]>([])
  const [isSendingInvites, setIsSendingInvites] = useState(false)
  const { toast } = useToast()

  const EMAIL_LIMIT = 100
  const [limitError, setLimitError] = useState("")

  const validateEmailLimit = (newCount: number) => {
    if (newCount > EMAIL_LIMIT) {
      setLimitError(
        `You cannot exceed the maximum of ${EMAIL_LIMIT} emails. Please remove ${newCount - EMAIL_LIMIT} email(s) to continue.`,
      )
      return false
    }
    setLimitError("")
    return true
  }

  const fetchSavedEmails = async () => {
    try {
      setIsLoading(true)
      const response = await fetch("/api/saved-emails")
      if (!response.ok) throw new Error("Failed to fetch saved emails")

      const data = await response.json()
      setSavedEmails(data.savedEmails || [])
    } catch (error) {
      console.error("Error fetching saved emails:", error)
      toast({
        title: "Error",
        description: "Failed to load saved emails",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    if (open) {
      fetchSavedEmails()
    }
  }, [open])
  /* eslint-enable react-hooks/exhaustive-deps */

  const handleAddEmail = async () => {
    if (!newEmail.trim()) return

    if (!validateEmailLimit(savedEmails.length + 1)) {
      toast({
        title: "Email limit exceeded",
        description: `Maximum emails is ${EMAIL_LIMIT}`,
        variant: "destructive",
      })
      return
    }

    try {
      const response = await fetch("/api/saved-emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emails: [
            {
              email: newEmail.trim().toLowerCase(),
              name: newName.trim() || null,
            },
          ],
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to add email")
      }

      setNewEmail("")
      setNewName("")
      await fetchSavedEmails()
      toast({
        title: "Success",
        description: "Email added successfully",
      })
    } catch (error) {
      console.error("Error adding email:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add email",
        variant: "destructive",
      })
    }
  }

  const handleDeleteEmail = async (emailId: string) => {
    try {
      const response = await fetch(`/api/saved-emails?id=${emailId}`, {
        method: "DELETE",
      })

      if (!response.ok) throw new Error("Failed to delete email")

      await fetchSavedEmails()
      toast({
        title: "Success",
        description: "Email deleted successfully",
      })
    } catch (error) {
      console.error("Error deleting email:", error)
      toast({
        title: "Error",
        description: "Failed to delete email",
        variant: "destructive",
      })
    }
  }

  const handleCsvUpload = async () => {
    if (!csvFile) return

    try {
      setIsLoading(true)
      const formData = new FormData()
      formData.append("file", csvFile)

      const response = await fetch("/api/saved-emails/bulk", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to upload CSV")
      }

      const result = await response.json()

      const newTotal = savedEmails.length + result.added
      if (!validateEmailLimit(newTotal)) {
        toast({
          title: "Email limit exceeded",
          description: `CSV upload would exceed the maximum of ${EMAIL_LIMIT} emails`,
          variant: "destructive",
        })
        return
      }

      setCsvFile(null)
      await fetchSavedEmails()

      toast({
        title: "Success",
        description: `Added ${result.added} emails, skipped ${result.skipped} duplicates`,
      })
    } catch (error) {
      console.error("Error uploading CSV:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to upload CSV",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleBulkAdd = async () => {
    if (!bulkEmails.trim()) return

    try {
      setIsLoading(true)
      const emails = bulkEmails
        .split(/[,\n]/)
        .map((email) => email.trim().toLowerCase())
        .filter((email) => email?.includes("@"))

      if (emails.length === 0) {
        throw new Error("No valid emails found")
      }

      const newTotal = savedEmails.length + emails.length
      if (!validateEmailLimit(newTotal)) {
        toast({
          title: "Email limit exceeded",
          description: `Bulk add would exceed the maximum of ${EMAIL_LIMIT} emails`,
          variant: "destructive",
        })
        return
      }

      const response = await fetch("/api/saved-emails/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emails }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to add emails")
      }

      const result = await response.json()
      setBulkEmails("")
      await fetchSavedEmails()

      toast({
        title: "Success",
        description: `Added ${result.added} emails, skipped ${result.skipped} duplicates`,
      })
    } catch (error) {
      console.error("Error adding bulk emails:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add emails",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const exportEmails = () => {
    const csvContent = ["email,name", ...savedEmails.map((email) => `${email.email},${email.name || ""}`)].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "saved-emails.csv"
    a.click()
    URL.revokeObjectURL(url)
  }

  const sendInvitations = async () => {
    if (selectedEmails.length === 0) {
      toast({
        title: "No emails selected",
        description: "Please select emails to send invitations to",
        variant: "destructive",
      })
      return
    }

    try {
      setIsSendingInvites(true)
      const response = await fetch("/api/global-invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emails: selectedEmails,
          role: "viewer",
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to send invitations")
      }

      await response.json()

      toast({
        title: "Invitations sent",
        description: `Successfully sent ${selectedEmails.length} invitation${selectedEmails.length > 1 ? "s" : ""}`,
      })

      setSelectedEmails([])
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send invitations",
        variant: "destructive",
      })
    } finally {
      setIsSendingInvites(false)
    }
  }

  const toggleEmailSelection = (emailId: string, email: string) => {
    setSelectedEmails((prev) => (prev.includes(email) ? prev.filter((e) => e !== email) : [...prev, email]))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Email Lists</DialogTitle>
          <DialogDescription>
            Manage your saved email contacts and send invitations. Maximum emails is {EMAIL_LIMIT}
          </DialogDescription>
        </DialogHeader>

        {limitError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{limitError}</AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="manage" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="manage">Manage Emails</TabsTrigger>
            <TabsTrigger value="upload">Upload CSV</TabsTrigger>
            <TabsTrigger value="bulk">Bulk Add</TabsTrigger>
          </TabsList>

          <TabsContent value="manage" className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">
                Saved Emails ({savedEmails.length}/{EMAIL_LIMIT})
              </h3>
              <div className="flex gap-2">
                <Button
                  onClick={sendInvitations}
                  disabled={selectedEmails.length === 0 || isSendingInvites}
                  variant="default"
                >
                  {isSendingInvites && "Sending..."}
                  {!isSendingInvites && `Send ${selectedEmails.length} Invite${selectedEmails.length === 1 ? "" : "s"}`}
                </Button>
                <Button variant="outline" size="sm" onClick={exportEmails} disabled={savedEmails.length === 0}>
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="new-email">Email Address</Label>
                <Input
                  id="new-email"
                  type="email"
                  placeholder="Enter email address"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddEmail()}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-name">Name (Optional)</Label>
                <div className="flex gap-2">
                  <Input
                    id="new-name"
                    placeholder="Enter name"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddEmail()}
                  />
                  <Button onClick={handleAddEmail} disabled={!newEmail.trim() || savedEmails.length >= EMAIL_LIMIT}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="max-h-60 overflow-y-auto border rounded-lg p-4">
              {isLoading && (
                <p className="text-center text-gray-500">Loading...</p>
              )}
              {!isLoading && savedEmails.length === 0 && (
                <p className="text-center text-gray-500">No saved emails yet</p>
              )}
              {!isLoading && savedEmails.length > 0 && (
                <div className="space-y-2">
                  {savedEmails.map((email) => (
                    <div key={email.id} className="flex items-center justify-between p-2 border rounded">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selectedEmails.includes(email.email)}
                          onChange={() => toggleEmailSelection(email.id, email.email)}
                          className="rounded"
                        />
                        <div>
                          <span className="font-medium">{email.email}</span>
                          {email.name && <span className="text-gray-500 ml-2">({email.name})</span>}
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteEmail(email.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="upload" className="space-y-4">
            <div className="space-y-4">
              <div>
                <Label htmlFor="csv-file">Upload CSV File</Label>
                <p className="text-sm text-gray-500 mb-2">CSV should have columns: email, name (optional)</p>
                <div className="flex gap-2">
                  <Input
                    id="csv-file"
                    type="file"
                    accept=".csv"
                    onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                  />
                  <Button
                    onClick={handleCsvUpload}
                    disabled={!csvFile || isLoading || savedEmails.length >= EMAIL_LIMIT}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Upload
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="bulk" className="space-y-4">
            <div className="space-y-4">
              <div>
                <Label htmlFor="bulk-emails">Bulk Add Emails</Label>
                <p className="text-sm text-gray-500 mb-2">Enter multiple emails separated by commas or new lines</p>
                <Textarea
                  id="bulk-emails"
                  placeholder="email1@example.com, email2@example.com&#10;email3@example.com"
                  value={bulkEmails}
                  onChange={(e) => setBulkEmails(e.target.value)}
                  rows={6}
                />
                <Button
                  onClick={handleBulkAdd}
                  disabled={!bulkEmails.trim() || isLoading || savedEmails.length >= EMAIL_LIMIT}
                  className="mt-2"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Emails
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

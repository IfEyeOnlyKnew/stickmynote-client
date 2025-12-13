"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { UserPlus, Upload, Trash2, Loader2, Users } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface Account {
  id: string
  username: string | null
  email: string
  full_name: string | null
  created_at: string
}

export function AccountsManager() {
  const { toast } = useToast()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // Single account form
  const [username, setUsername] = useState("")
  const [email, setEmail] = useState("")
  const [fullName, setFullName] = useState("")

  // CSV import
  const [csvText, setCsvText] = useState("")

  useEffect(() => {
    fetchAccounts()
  }, [])

  const fetchAccounts = async () => {
    try {
      const response = await fetch("/api/social-accounts")
      if (response.ok) {
        const data = await response.json()
        setAccounts(data.accounts || [])
      }
    } catch (error) {
      console.error("Error fetching accounts:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return

    setSubmitting(true)
    try {
      const response = await fetch("/api/social-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim() || null,
          email: email.trim(),
          full_name: fullName.trim() || null,
        }),
      })

      if (response.ok) {
        toast({ title: "Account added successfully" })
        setUsername("")
        setEmail("")
        setFullName("")
        fetchAccounts()
      } else {
        const data = await response.json()
        toast({ title: "Error", description: data.error, variant: "destructive" })
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to add account", variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  const handleImportCSV = async () => {
    if (!csvText.trim()) return

    setSubmitting(true)
    try {
      // Parse CSV (simple parsing: username,email,full_name)
      const lines = csvText.trim().split("\n")
      const accounts = lines
        .map((line) => {
          const [username, email, full_name] = line.split(",").map((s) => s.trim())
          return { username, email, full_name }
        })
        .filter((acc) => acc.email) // Only include lines with email

      if (accounts.length === 0) {
        toast({ title: "Error", description: "No valid accounts found in CSV", variant: "destructive" })
        return
      }

      const response = await fetch("/api/social-accounts/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accounts }),
      })

      if (response.ok) {
        const data = await response.json()
        toast({
          title: "Import complete",
          description: `Created: ${data.created}, Skipped: ${data.skipped}`,
        })
        setCsvText("")
        fetchAccounts()
      } else {
        const data = await response.json()
        toast({ title: "Error", description: data.error, variant: "destructive" })
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to import accounts", variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteAccount = async (accountId: string) => {
    if (!confirm("Are you sure you want to delete this account?")) return

    try {
      const response = await fetch(`/api/social-accounts/${accountId}`, {
        method: "DELETE",
      })

      if (response.ok) {
        toast({ title: "Account deleted successfully" })
        fetchAccounts()
      } else {
        toast({ title: "Error", description: "Failed to delete account", variant: "destructive" })
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to delete account", variant: "destructive" })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Manage Accounts
          </CardTitle>
          <CardDescription>
            Add contacts that can be invited to your social pads. You can add them individually or import via CSV.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="single" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="single">
                <UserPlus className="h-4 w-4 mr-2" />
                Add Single
              </TabsTrigger>
              <TabsTrigger value="csv">
                <Upload className="h-4 w-4 mr-2" />
                Import CSV
              </TabsTrigger>
            </TabsList>

            <TabsContent value="single" className="space-y-4">
              <form onSubmit={handleAddAccount} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="username">Username</Label>
                    <Input
                      id="username"
                      placeholder="johndoe"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      disabled={submitting}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="john@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={submitting}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Full Name</Label>
                    <Input
                      id="fullName"
                      placeholder="John Doe"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      disabled={submitting}
                    />
                  </div>
                </div>
                <Button type="submit" disabled={submitting || !email.trim()}>
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-4 w-4 mr-2" />
                      Add Account
                    </>
                  )}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="csv" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="csv">CSV Data</Label>
                <Textarea
                  id="csv"
                  placeholder="username,email,full_name&#10;johndoe,john@example.com,John Doe&#10;janedoe,jane@example.com,Jane Doe"
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                  disabled={submitting}
                  rows={8}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-gray-500">
                  Format: username,email,full_name (one per line, email is required)
                </p>
              </div>
              <Button onClick={handleImportCSV} disabled={submitting || !csvText.trim()}>
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Import Accounts
                  </>
                )}
              </Button>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Accounts List */}
      <Card>
        <CardHeader>
          <CardTitle>Your Accounts ({accounts.length})</CardTitle>
          <CardDescription>Manage your saved contacts for invitations</CardDescription>
        </CardHeader>
        <CardContent>
          {accounts.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No accounts yet. Add some above to get started.</p>
          ) : (
            <div className="space-y-2">
              {accounts.map((account) => (
                <div
                  key={account.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
                >
                  <div className="flex-1">
                    <div className="font-medium">{account.full_name || account.username || "No name"}</div>
                    <div className="text-sm text-gray-600">{account.email}</div>
                    {account.username && <div className="text-xs text-gray-500">@{account.username}</div>}
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => handleDeleteAccount(account.id)}>
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Globe, Plus, Trash2, Star, Shield, Loader2, AlertCircle } from "lucide-react"
import { toast } from "sonner"

interface Domain {
  id: string
  org_id: string
  domain: string
  is_primary: boolean
  is_verified: boolean
  verified_at: string | null
  created_at: string
}

interface DomainManagerProps {
  orgId: string
  canManage: boolean
}

export function DomainManager({ orgId, canManage }: DomainManagerProps) {
  const [domains, setDomains] = useState<Domain[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [newDomain, setNewDomain] = useState("")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchDomains()
  }, [orgId])

  async function fetchDomains() {
    try {
      setLoading(true)
      const res = await fetch(`/api/organizations/${orgId}/domains`)
      if (!res.ok) throw new Error("Failed to fetch domains")
      const data = await res.json()
      setDomains(data.domains || [])
    } catch (err) {
      console.error("Error fetching domains:", err)
      setError("Failed to load domains")
    } finally {
      setLoading(false)
    }
  }

  async function handleAddDomain(e: React.FormEvent) {
    e.preventDefault()
    if (!newDomain.trim()) return

    try {
      setAdding(true)
      setError(null)

      const res = await fetch(`/api/organizations/${orgId}/domains`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domain: newDomain.trim(),
          is_primary: domains.length === 0,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Failed to add domain")
      }

      setDomains((prev) => [...prev, data.domain])
      setNewDomain("")
      toast.success("Domain added successfully")
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to add domain"
      setError(message)
      toast.error(message)
    } finally {
      setAdding(false)
    }
  }

  async function handleSetPrimary(domainId: string) {
    try {
      const res = await fetch(`/api/organizations/${orgId}/domains/${domainId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_primary: true }),
      })

      if (!res.ok) throw new Error("Failed to update domain")

      setDomains((prev) =>
        prev.map((d) => ({
          ...d,
          is_primary: d.id === domainId,
        })),
      )
      toast.success("Primary domain updated")
    } catch (err) {
      toast.error("Failed to set primary domain")
    }
  }

  async function handleDeleteDomain(domainId: string) {
    try {
      const res = await fetch(`/api/organizations/${orgId}/domains/${domainId}`, {
        method: "DELETE",
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to delete domain")
      }

      setDomains((prev) => prev.filter((d) => d.id !== domainId))
      toast.success("Domain removed")
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete domain"
      toast.error(message)
    }
  }

  async function handleVerifyDomain(domainId: string) {
    try {
      const res = await fetch(`/api/organizations/${orgId}/domains/${domainId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_verified: true }),
      })

      if (!res.ok) throw new Error("Failed to verify domain")

      const data = await res.json()
      setDomains((prev) => prev.map((d) => (d.id === domainId ? data.domain : d)))
      toast.success("Domain verified")
    } catch (err) {
      toast.error("Failed to verify domain")
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5" />
          Organization Domains
        </CardTitle>
        <CardDescription>
          Manage domains associated with your organization. Users with email addresses from these domains can request
          access.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Domain List */}
        {domains.length > 0 ? (
          <div className="space-y-2">
            {domains.map((domain) => (
              <div
                key={domain.id}
                className="flex items-center justify-between p-3 border rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <span className="font-mono text-sm">{domain.domain}</span>
                  <div className="flex gap-1">
                    {domain.is_primary && (
                      <Badge variant="default" className="text-xs">
                        <Star className="h-3 w-3 mr-1" />
                        Primary
                      </Badge>
                    )}
                    {domain.is_verified ? (
                      <Badge variant="secondary" className="text-xs bg-green-100 text-green-800">
                        <Shield className="h-3 w-3 mr-1" />
                        Verified
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">
                        Unverified
                      </Badge>
                    )}
                  </div>
                </div>

                {canManage && (
                  <div className="flex items-center gap-2">
                    {!domain.is_verified && (
                      <Button variant="outline" size="sm" onClick={() => handleVerifyDomain(domain.id)}>
                        Verify
                      </Button>
                    )}
                    {!domain.is_primary && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSetPrimary(domain.id)}
                        title="Set as primary"
                      >
                        <Star className="h-4 w-4" />
                      </Button>
                    )}
                    {domains.length > 1 && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remove Domain</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to remove <strong>{domain.domain}</strong>? Users with this domain
                              will no longer be associated with your organization.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteDomain(domain.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Remove
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 text-muted-foreground">
            <Globe className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No domains configured</p>
            <p className="text-sm">Add your organization&apos;s email domains to enable access control</p>
          </div>
        )}

        {/* Add Domain Form */}
        {canManage && (
          <form onSubmit={handleAddDomain} className="flex gap-2 pt-4 border-t">
            <div className="flex-1">
              <Label htmlFor="new-domain" className="sr-only">
                New Domain
              </Label>
              <Input
                id="new-domain"
                type="text"
                placeholder="example.com or subdomain.example.com"
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                disabled={adding}
              />
            </div>
            <Button type="submit" disabled={adding || !newDomain.trim()}>
              {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              <span className="ml-2">Add</span>
            </Button>
          </form>
        )}

        {error && (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        {/* Help Text */}
        <div className="text-xs text-muted-foreground pt-2">
          <p>
            <strong>Tip:</strong> Add all email domains and subdomains used by your organization (e.g., company.com,
            mail.company.com, subsidiary.com).
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

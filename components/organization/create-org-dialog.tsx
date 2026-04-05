"use client"

import { useState } from "react"
import { useOrganization } from "@/contexts/organization-context"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface CreateOrgDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreateOrgDialog({ open, onOpenChange }: Readonly<CreateOrgDialogProps>) {
  const { createOrganization, switchOrganization } = useOrganization()
  const { toast } = useToast()

  const [name, setName] = useState("")
  const [type, setType] = useState<"team" | "enterprise">("team")
  const [loading, setLoading] = useState(false)

  const handleCreate = async () => {
    if (!name.trim() || name.trim().length < 2) {
      toast({
        title: "Invalid name",
        description: "Organization name must be at least 2 characters",
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    try {
      const newOrg = await createOrganization(name.trim(), type)

      if (newOrg) {
        toast({
          title: "Organization created",
          description: `${newOrg.name} has been created successfully`,
        })

        // Switch to the new org
        await switchOrganization(newOrg.id)

        // Reset form and close
        setName("")
        setType("team")
        onOpenChange(false)
      } else {
        toast({
          title: "Failed to create organization",
          description: "Please try again",
          variant: "destructive",
        })
      }
    } catch (err) {
      console.error("Error creating org:", err)
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create Organization</DialogTitle>
          <DialogDescription>Create a new organization to collaborate with your team.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Organization Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Team"
              disabled={loading}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="type">Organization Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as "team" | "enterprise")} disabled={loading}>
              <SelectTrigger id="type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="team">Team</SelectItem>
                <SelectItem value="enterprise">Enterprise</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {type === "team" ? "Best for small teams and projects" : "For larger organizations with advanced needs"}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

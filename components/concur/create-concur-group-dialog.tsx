"use client"

import { useState } from "react"
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
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface CreateConcurGroupDialogProps {
  onClose: () => void
  onCreated: () => void
}

export function CreateConcurGroupDialog({ onClose, onCreated }: CreateConcurGroupDialogProps) {
  const { toast } = useToast()
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [owner1Email, setOwner1Email] = useState("")
  const [owner2Email, setOwner2Email] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast({ title: "Group name is required", variant: "destructive" })
      return
    }
    if (!owner1Email.trim() || !owner2Email.trim()) {
      toast({ title: "Both owner emails are required", variant: "destructive" })
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch("/api/concur/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          owner1Email: owner1Email.trim(),
          owner2Email: owner2Email.trim(),
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        toast({ title: data.error || "Failed to create group", variant: "destructive" })
        return
      }

      toast({ title: "Concur group created!" })
      onCreated()
    } catch {
      toast({ title: "Failed to create group", variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Concur Group</DialogTitle>
          <DialogDescription>
            Create a new group with two designated owners who will manage members.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="group-name">Group Name</Label>
            <Input
              id="group-name"
              placeholder="e.g. Engineering Team"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
            />
          </div>

          <div>
            <Label htmlFor="group-description">Description (optional)</Label>
            <Textarea
              id="group-description"
              placeholder="What is this group for?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={500}
            />
          </div>

          <div>
            <Label htmlFor="owner1-email">Owner 1 Email</Label>
            <Input
              id="owner1-email"
              type="email"
              placeholder="owner1@company.com"
              value={owner1Email}
              onChange={(e) => setOwner1Email(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="owner2-email">Owner 2 Email</Label>
            <Input
              id="owner2-email"
              type="email"
              placeholder="owner2@company.com"
              value={owner2Email}
              onChange={(e) => setOwner2Email(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || !name.trim() || !owner1Email.trim() || !owner2Email.trim()}
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Create Group
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

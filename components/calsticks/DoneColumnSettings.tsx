"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Archive, Settings, Loader2 } from 'lucide-react'
import { useToast } from "@/hooks/use-toast"

interface DoneColumnSettingsProps {
  readonly onArchiveAll: () => Promise<void>
  readonly onViewArchived: () => void
}

export function DoneColumnSettings({ onArchiveAll, onViewArchived }: DoneColumnSettingsProps) {
  const [open, setOpen] = useState(false)
  const [autoArchiveDays, setAutoArchiveDays] = useState(14)
  const [loading, setLoading] = useState(false)
  const [archiving, setArchiving] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    if (open) {
      fetchSettings()
    }
  }, [open])

  const fetchSettings = async () => {
    try {
      setLoading(true)
      const response = await fetch("/api/calsticks/settings")
      if (response.ok) {
        const data = await response.json()
        setAutoArchiveDays(data.autoArchiveDays)
      }
    } catch (error) {
      console.error("Failed to fetch settings:", error)
    } finally {
      setLoading(false)
    }
  }

  const saveSettings = async () => {
    try {
      setLoading(true)
      const response = await fetch("/api/calsticks/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoArchiveDays }),
      })

      if (response.ok) {
        toast({
          title: "Settings saved",
          description: `Done items will auto-hide after ${autoArchiveDays} days`,
        })
        setOpen(false)
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to save settings",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleArchiveAll = async () => {
    try {
      setArchiving(true)
      await onArchiveAll()
      toast({
        title: "Tasks archived",
        description: "Old completed tasks have been archived",
      })
    } catch {
      toast({
        title: "Error",
        description: "Failed to archive tasks",
        variant: "destructive",
      })
    } finally {
      setArchiving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
          <Settings className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Done Column Settings</DialogTitle>
          <DialogDescription>
            Configure how completed tasks are managed on your Kanban board.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="auto-archive">Auto-hide completed tasks after</Label>
            <Select
              value={autoArchiveDays.toString()}
              onValueChange={(value) => setAutoArchiveDays(Number.parseInt(value))}
              disabled={loading}
            >
              <SelectTrigger id="auto-archive">
                <SelectValue placeholder="Select days" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Never (show all)</SelectItem>
                <SelectItem value="7">7 days</SelectItem>
                <SelectItem value="14">14 days</SelectItem>
                <SelectItem value="30">30 days</SelectItem>
                <SelectItem value="60">60 days</SelectItem>
                <SelectItem value="90">90 days</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Tasks in the Done column will be automatically hidden from the board after this period.
              They can still be found in the archive.
            </p>
          </div>

          <div className="border-t pt-4 space-y-2">
            <Label>Manual Actions</Label>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleArchiveAll}
                disabled={archiving}
                className="flex-1 bg-transparent"
              >
                {archiving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Archive className="h-4 w-4 mr-2" />
                )}
                Archive Old Tasks
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setOpen(false)
                  onViewArchived()
                }}
                className="flex-1"
              >
                View Archived
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Archive all completed tasks older than {autoArchiveDays} days, or view previously archived tasks.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={saveSettings} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Settings
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

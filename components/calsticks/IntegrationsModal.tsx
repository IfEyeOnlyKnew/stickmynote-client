"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"
import { Calendar, FileSpreadsheet, Mail, Copy, Check, RefreshCw, Download } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { useUser } from "@/contexts/UserContext"

interface IntegrationsModalProps {
  readonly isOpen: boolean
  readonly onClose: () => void
}

export function IntegrationsModal({ isOpen, onClose }: Readonly<IntegrationsModalProps>) {
  const { user } = useUser()
  const [userId, setUserId] = useState<string>("")
  const [icalUrl, setIcalUrl] = useState<string>("")
  const [loadingFeed, setLoadingFeed] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (isOpen && user) {
      setUserId(user.id)
      fetchFeedUrl()
    }
  }, [isOpen, user])

  const fetchFeedUrl = async () => {
    try {
      const res = await fetch("/api/calsticks/feed/generate")
      if (!res.ok) {
        console.error("Failed to fetch feed: HTTP", res.status)
        return
      }

      const contentType = res.headers.get("content-type")
      if (!contentType?.includes("application/json")) {
        console.error("Failed to fetch feed: Response is not JSON")
        return
      }

      const data = await res.json()
      if (data.url) {
        setIcalUrl(data.url)
      }
    } catch (error) {
      console.error("Failed to fetch feed", error)
    }
  }

  const generateNewFeed = async () => {
    setLoadingFeed(true)
    try {
      const res = await fetch("/api/calsticks/feed/generate", { method: "POST" })
      if (!res.ok) {
        toast({ title: "Error", description: "Failed to generate feed", variant: "destructive" })
        return
      }

      const contentType = res.headers.get("content-type")
      if (!contentType?.includes("application/json")) {
        toast({ title: "Error", description: "Server error - invalid response", variant: "destructive" })
        return
      }

      const data = await res.json()
      if (data.url) {
        setIcalUrl(data.url)
        toast({ title: "Feed Generated", description: "Your new calendar feed is ready." })
      }
    } catch (error) {
      console.error("Failed to generate feed:", error)
      toast({ title: "Error", description: "Failed to generate feed", variant: "destructive" })
    } finally {
      setLoadingFeed(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast({ title: "Copied!", description: "URL copied to clipboard" })
  }

  const downloadCsv = () => {
    globalThis.location.href = "/api/calsticks/export/csv"
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Deep Integrations</DialogTitle>
          <DialogDescription>Connect your CalSticks with external tools and workflows.</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="calendar" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="calendar" className="gap-2">
              <Calendar className="h-4 w-4" />
              Calendar Sync
            </TabsTrigger>
            <TabsTrigger value="email" className="gap-2">
              <Mail className="h-4 w-4" />
              Email to Task
            </TabsTrigger>
            <TabsTrigger value="export" className="gap-2">
              <FileSpreadsheet className="h-4 w-4" />
              Data Export
            </TabsTrigger>
          </TabsList>

          <TabsContent value="calendar" className="space-y-4 py-4">
            <div className="bg-muted/50 p-4 rounded-lg space-y-2">
              <h3 className="font-semibold flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                iCal Feed (.ics)
              </h3>
              <p className="text-sm text-muted-foreground">
                Subscribe to your tasks in Outlook, Google Calendar, or Apple Calendar. This feed updates automatically.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Your Private Feed URL</Label>
              <div className="flex gap-2">
                <Input
                  value={icalUrl}
                  readOnly
                  placeholder="Click generate to create your feed URL..."
                  className="font-mono text-sm"
                />
                <Button variant="outline" onClick={() => copyToClipboard(icalUrl)} disabled={!icalUrl}>
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <div className="flex justify-end">
                <Button onClick={generateNewFeed} disabled={loadingFeed} size="sm" variant="secondary">
                  <RefreshCw className={`h-3 w-3 mr-2 ${loadingFeed ? "animate-spin" : ""}`} />
                  {icalUrl ? "Regenerate URL" : "Generate URL"}
                </Button>
              </div>
            </div>

            <div className="text-sm text-muted-foreground bg-yellow-50/50 dark:bg-yellow-950/20 p-3 rounded border border-yellow-200 dark:border-yellow-800">
              <strong>Security Note:</strong> Treat this URL like a password. Anyone with this link can view your tasks.
              Regenerate it if you suspect it has been shared.
            </div>
          </TabsContent>

          <TabsContent value="email" className="space-y-4 py-4">
            <div className="bg-muted/50 p-4 rounded-lg space-y-2">
              <h3 className="font-semibold flex items-center gap-2">
                <Mail className="h-4 w-4 text-primary" />
                Email to Task
              </h3>
              <p className="text-sm text-muted-foreground">
                Forward emails to this address to automatically create tasks. The subject becomes the task content.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Your Inbound Address</Label>
              <div className="flex gap-2">
                <Input value={`task+${userId || "..."}@stickmynote.com`} readOnly className="font-mono text-sm" />
                <Button variant="outline" onClick={() => copyToClipboard(`task+${userId}@stickmynote.com`)}>
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Note: Tasks will be added to your &quot;Inbox&quot; stick. If it doesn&apos;t exist, one will be created.
              </p>
            </div>
          </TabsContent>

          <TabsContent value="export" className="space-y-4 py-4">
            <div className="bg-muted/50 p-4 rounded-lg space-y-2">
              <h3 className="font-semibold flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-primary" />
                CSV Export
              </h3>
              <p className="text-sm text-muted-foreground">
                Download a complete CSV report of all your tasks, including completed items, time tracking data, and
                priority labels.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <Button onClick={downloadCsv} className="w-full sm:w-auto self-start">
                <Download className="h-4 w-4 mr-2" />
                Download CSV Report
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

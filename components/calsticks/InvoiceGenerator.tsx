"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Checkbox } from "@/components/ui/checkbox"
import { CalendarIcon, FileText } from "lucide-react"
import { format } from "date-fns"
import { toast } from "@/hooks/use-toast"

interface TimeEntryForInvoice {
  id: string
  task_id: string
  duration_seconds: number
  is_billable: boolean
  note: string | null
  task?: { content: string; stick?: { topic: string } | null } | null
}

interface Project {
  id: string
  name: string
  hourly_rate_cents: number
}

interface InvoiceGeneratorProps {
  isOpen: boolean
  onClose: () => void
  onCreated: () => void
}

export function InvoiceGenerator({ isOpen, onClose, onCreated }: Readonly<InvoiceGeneratorProps>) {
  const [step, setStep] = useState(1)
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState("")
  const [startDate, setStartDate] = useState<Date>(new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const [endDate, setEndDate] = useState<Date>(new Date())
  const [entries, setEntries] = useState<TimeEntryForInvoice[]>([])
  const [selectedEntryIds, setSelectedEntryIds] = useState<Set<string>>(new Set())
  const [clientName, setClientName] = useState("")
  const [clientEmail, setClientEmail] = useState("")
  const [taxRate, setTaxRate] = useState(0)
  const [notes, setNotes] = useState("")
  const [dueDate, setDueDate] = useState<Date | undefined>()
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (isOpen) {
      fetchProjects()
      setStep(1)
    }
  }, [isOpen])

  const fetchProjects = async () => {
    try {
      const response = await fetch("/api/calsticks/budget")
      if (response.ok) {
        const data = await response.json()
        setProjects((data.projects || []).map((p: any) => ({
          id: p.padId,
          name: p.padName,
          hourly_rate_cents: p.hourlyRateCents || 0,
        })))
      }
    } catch {
      // Non-critical
    }
  }

  const fetchApprovedEntries = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        approvalStatus: "approved",
      })
      const response = await fetch(`/api/time-entries?${params}`)
      if (response.ok) {
        const data = await response.json()
        const billable = (data.entries || []).filter((e: any) => e.is_billable)
        setEntries(billable)
        setSelectedEntryIds(new Set(billable.map((e: any) => e.id)))
      }
    } catch {
      toast({ title: "Failed to fetch entries", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const toggleEntry = (id: string) => {
    setSelectedEntryIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const getProject = () => projects.find((p) => p.id === selectedProjectId)
  const getRateCents = () => getProject()?.hourly_rate_cents || 5000 // Default $50/hr

  const getSelectedEntries = () => entries.filter((e) => selectedEntryIds.has(e.id))

  const calculateSubtotal = () => {
    const rateCents = getRateCents()
    return getSelectedEntries().reduce((sum, e) => {
      const hours = (e.duration_seconds || 0) / 3600
      return sum + Math.round(hours * rateCents)
    }, 0)
  }

  const handleCreate = async () => {
    setCreating(true)
    try {
      const rateCents = getRateCents()
      const lineItems = getSelectedEntries().map((e) => {
        const hours = (e.duration_seconds || 0) / 3600
        return {
          timeEntryId: e.id,
          description: e.task?.stick?.topic || e.task?.content || "Time entry",
          hours: Math.round(hours * 100) / 100,
          rateCents,
          amountCents: Math.round(hours * rateCents),
        }
      })

      const response = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: selectedProjectId || null,
          clientName,
          clientEmail,
          taxRate,
          notes,
          dueDate: dueDate ? format(dueDate, "yyyy-MM-dd") : null,
          lineItems,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        toast({ title: `Invoice ${data.invoice.invoice_number} created` })
        onCreated()
        onClose()
      } else {
        throw new Error("Failed")
      }
    } catch {
      toast({ title: "Failed to create invoice", variant: "destructive" })
    } finally {
      setCreating(false)
    }
  }

  const subtotalCents = calculateSubtotal()
  const taxCents = Math.round(subtotalCents * (taxRate / 100))
  const totalCents = subtotalCents + taxCents

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Create Invoice — Step {step} of 3
          </DialogTitle>
        </DialogHeader>

        {/* Step 1: Select project + date range */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Project (optional)</Label>
              <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="All projects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">All projects</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start bg-transparent">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(startDate, "PPP")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar mode="single" selected={startDate} onSelect={(d) => d && setStartDate(d)} />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start bg-transparent">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(endDate, "PPP")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar mode="single" selected={endDate} onSelect={(d) => d && setEndDate(d)} />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <Button onClick={() => { fetchApprovedEntries(); setStep(2) }} className="w-full">
              Find Approved Billable Entries
            </Button>
          </div>
        )}

        {/* Step 2: Review entries */}
        {step === 2 && (
          <div className="space-y-4">
            {loading && (
              <div className="text-center py-8 text-muted-foreground">Loading entries...</div>
            )}
            {!loading && entries.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">No approved billable entries found for this period</div>
            )}
            {!loading && entries.length > 0 && (
              <>
                <div className="text-sm text-muted-foreground">{selectedEntryIds.size} of {entries.length} entries selected</div>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {entries.map((entry) => {
                    const hours = (entry.duration_seconds || 0) / 3600
                    return (
                      <div key={entry.id} className="flex items-center gap-3 p-2 border rounded">
                        <Checkbox checked={selectedEntryIds.has(entry.id)} onCheckedChange={() => toggleEntry(entry.id)} />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">
                            {entry.task?.stick?.topic || entry.task?.content || "Untitled"}
                          </div>
                          {entry.note && <div className="text-xs text-muted-foreground truncate">{entry.note}</div>}
                        </div>
                        <div className="text-sm font-mono shrink-0">{hours.toFixed(2)}h</div>
                        <div className="text-sm font-mono shrink-0">${(hours * getRateCents() / 100).toFixed(2)}</div>
                      </div>
                    )
                  })}
                </div>
                <div className="text-right font-medium">
                  Subtotal: ${(subtotalCents / 100).toFixed(2)}
                </div>
              </>
            )}
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
              <Button onClick={() => setStep(3)} disabled={selectedEntryIds.size === 0}>Next</Button>
            </div>
          </div>
        )}

        {/* Step 3: Client info + finalize */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Client Name</Label>
                <Input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Acme Corp" />
              </div>
              <div className="space-y-2">
                <Label>Client Email</Label>
                <Input value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} placeholder="billing@acme.com" type="email" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tax Rate (%)</Label>
                <Input type="number" value={taxRate} onChange={(e) => setTaxRate(Number(e.target.value))} min={0} max={100} step={0.5} />
              </div>
              <div className="space-y-2">
                <Label>Due Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start bg-transparent">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dueDate ? format(dueDate, "PPP") : "Select date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar mode="single" selected={dueDate} onSelect={setDueDate} />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Payment terms, additional notes..." rows={3} />
            </div>

            <div className="border-t pt-3 space-y-1 text-right">
              <div className="text-sm">Subtotal: ${(subtotalCents / 100).toFixed(2)}</div>
              {taxRate > 0 && <div className="text-sm">Tax ({taxRate}%): ${(taxCents / 100).toFixed(2)}</div>}
              <div className="text-lg font-bold">Total: ${(totalCents / 100).toFixed(2)}</div>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
              <Button onClick={handleCreate} disabled={creating}>
                {creating ? "Creating..." : "Create Invoice"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

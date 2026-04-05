"use client"

import { useState, useEffect, useCallback } from "react"
import { format } from "date-fns"
import { FileText, Plus, AlertCircle, Send, CreditCard, Ban } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { UserMenu } from "@/components/user-menu"
import { InvoiceGenerator } from "@/components/calsticks/InvoiceGenerator"
import { toast } from "@/hooks/use-toast"
import type { Invoice } from "@/types/calstick"

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  sent: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  paid: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  cancelled: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
}

const STATUS_ICONS: Record<string, typeof FileText> = {
  draft: FileText,
  sent: Send,
  paid: CreditCard,
  cancelled: Ban,
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [tableNotFound, setTableNotFound] = useState(false)
  const [showGenerator, setShowGenerator] = useState(false)

  const fetchInvoices = useCallback(async () => {
    try {
      const res = await fetch("/api/invoices")
      if (res.ok) {
        const data = await res.json()
        setInvoices(data.invoices || [])
        setTableNotFound(false)
      } else if (res.status === 500) {
        const data = await res.json().catch(() => ({}))
        if (data.error?.includes("does not exist") || data.error?.includes("relation")) {
          setTableNotFound(true)
        }
      }
    } catch {
      console.error("[Invoices] Fetch error")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchInvoices()
  }, [fetchInvoices])

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/invoices/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })
      if (res.ok) {
        toast({ title: `Invoice marked as ${newStatus}` })
        fetchInvoices()
      }
    } catch {
      toast({ title: "Error", description: "Failed to update invoice", variant: "destructive" })
    }
  }

  const fmt = (cents: number) => "$" + (cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const draftCount = invoices.filter((i) => i.status === "draft").length
  const sentCount = invoices.filter((i) => i.status === "sent").length
  const paidTotal = invoices.filter((i) => i.status === "paid").reduce((s, i) => s + (i.total_cents || 0), 0)
  const outstandingTotal = invoices.filter((i) => i.status === "sent").reduce((s, i) => s + (i.total_cents || 0), 0)

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" />
            Invoices
          </h1>
          <p className="text-muted-foreground">Create and manage invoices from tracked time</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setShowGenerator(true)} disabled={tableNotFound}>
            <Plus className="h-4 w-4 mr-2" />
            New Invoice
          </Button>
          <UserMenu />
        </div>
      </div>

      {tableNotFound && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Invoicing requires database migration. Please run{" "}
            <code className="bg-muted px-1 py-0.5 rounded">scripts/windows-server/43-time-tracking-enhancements.sql</code>
          </AlertDescription>
        </Alert>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">Drafts</div>
            <div className="text-2xl font-bold">{draftCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">Sent</div>
            <div className="text-2xl font-bold text-blue-600">{sentCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">Paid Total</div>
            <div className="text-2xl font-bold text-green-600">{fmt(paidTotal)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">Outstanding</div>
            <div className="text-2xl font-bold text-amber-600">{fmt(outstandingTotal)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Invoices List */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="pt-4"><div className="h-16 bg-muted rounded" /></CardContent>
            </Card>
          ))}
        </div>
      )}
      {!loading && invoices.length === 0 && !tableNotFound && (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground py-12">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-2" />
            <p>No invoices yet</p>
            <p className="text-sm mt-1">Create your first invoice from approved billable time entries</p>
          </CardContent>
        </Card>
      )}
      {!loading && (invoices.length > 0 || tableNotFound) && (
        <div className="space-y-2">
          {invoices.map((invoice) => {
            const StatusIcon = STATUS_ICONS[invoice.status] || FileText
            return (
              <Card key={invoice.id}>
                <CardContent className="py-4 flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <StatusIcon className="h-5 w-5 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <div className="font-medium">{invoice.invoice_number}</div>
                      <div className="text-sm text-muted-foreground truncate">
                        {invoice.client_name || "No client"}{" "}
                        {invoice.due_date && `· Due ${format(new Date(invoice.due_date), "MMM d, yyyy")}`}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 ml-4">
                    <span className="font-semibold tabular-nums">{fmt(invoice.total_cents || 0)}</span>
                    <Badge className={STATUS_COLORS[invoice.status]} variant="outline">
                      {invoice.status}
                    </Badge>
                    {invoice.status === "draft" && (
                      <Button size="sm" variant="outline" onClick={() => handleStatusChange(invoice.id, "sent")}>
                        <Send className="h-3.5 w-3.5 mr-1" /> Send
                      </Button>
                    )}
                    {invoice.status === "sent" && (
                      <Button size="sm" variant="outline" onClick={() => handleStatusChange(invoice.id, "paid")}>
                        <CreditCard className="h-3.5 w-3.5 mr-1" /> Paid
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <InvoiceGenerator
        isOpen={showGenerator}
        onClose={() => setShowGenerator(false)}
        onCreated={() => { setShowGenerator(false); fetchInvoices() }}
      />
    </div>
  )
}

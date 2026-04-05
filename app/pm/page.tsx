"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { UserMenu } from "@/components/user-menu"
import {
  Clock,
  FileText,
  DollarSign,
  BarChart3,
  Target,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Timer,
} from "lucide-react"

interface DashboardData {
  timeTracking: {
    hoursThisWeek: number
    billableHours: number
    pendingApproval: number
    activeTimer: boolean
  }
  invoices: {
    draftCount: number
    sentCount: number
    paidTotal: number
    outstandingTotal: number
  }
  budget: {
    totalBudget: number
    totalSpent: number
    percentUsed: number
    projectCount: number
  }
  portfolio: {
    totalTasks: number
    completedTasks: number
    overdueTasks: number
    completionRate: number
  }
  goals: {
    totalObjectives: number
    onTrack: number
    atRisk: number
    avgProgress: number
  }
}

export default function PMDashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDashboard()
  }, [])

  async function loadDashboard() {
    try {
      // Fetch data from multiple endpoints in parallel
      const [timeRes, invoiceRes, budgetRes, portfolioRes, goalsRes] = await Promise.allSettled([
        fetch("/api/time-entries?start=" + getWeekStart()).then(r => r.json()),
        fetch("/api/invoices").then(r => r.json()),
        fetch("/api/calsticks/budget").then(r => r.json()),
        fetch("/api/calsticks/portfolio").then(r => r.json()),
        fetch("/api/calsticks/objectives").then(r => r.json()),
      ])

      const entries = timeRes.status === "fulfilled" ? (timeRes.value.entries || []) : []
      const invoices = invoiceRes.status === "fulfilled" ? (invoiceRes.value.invoices || []) : []
      const projects = budgetRes.status === "fulfilled" ? (budgetRes.value.projects || []) : []
      const portfolio = portfolioRes.status === "fulfilled" ? portfolioRes.value : null
      const objectives = goalsRes.status === "fulfilled" ? (goalsRes.value.objectives || goalsRes.value || []) : []

      // Time tracking metrics
      const totalSeconds = entries.reduce((sum: number, e: any) => sum + (e.duration_seconds || 0), 0)
      const billableSeconds = entries.filter((e: any) => e.is_billable !== false).reduce((sum: number, e: any) => sum + (e.duration_seconds || 0), 0)
      const pendingApproval = entries.filter((e: any) => e.approval_status === "submitted").length
      const activeTimer = entries.some((e: any) => !e.ended_at)

      // Invoice metrics
      const draftInvoices = invoices.filter((i: any) => i.status === "draft")
      const sentInvoices = invoices.filter((i: any) => i.status === "sent")
      const paidInvoices = invoices.filter((i: any) => i.status === "paid")
      const paidTotal = paidInvoices.reduce((sum: number, i: any) => sum + (i.total_cents || 0), 0)
      const outstandingTotal = sentInvoices.reduce((sum: number, i: any) => sum + (i.total_cents || 0), 0)

      // Budget metrics
      const totalBudget = projects.reduce((sum: number, p: any) => sum + (p.budgetCents || 0), 0)
      const totalSpent = projects.reduce((sum: number, p: any) => sum + (p.totalActualCost || 0), 0)

      // Portfolio metrics
      const totalTasks = portfolio?.totalTasks || 0
      const completedTasks = portfolio?.completedTasks || 0
      const overdueTasks = portfolio?.overdueTasks || 0

      // Goals metrics
      const objectiveList = Array.isArray(objectives) ? objectives : []
      const onTrack = objectiveList.filter((o: any) => o.status === "on-track" || o.progress >= 60).length
      const atRisk = objectiveList.filter((o: any) => o.status === "at-risk" || (o.progress < 40 && o.progress > 0)).length
      const avgProgress = objectiveList.length > 0
        ? objectiveList.reduce((sum: number, o: any) => sum + (o.progress || 0), 0) / objectiveList.length
        : 0

      setData({
        timeTracking: {
          hoursThisWeek: totalSeconds / 3600,
          billableHours: billableSeconds / 3600,
          pendingApproval,
          activeTimer,
        },
        invoices: {
          draftCount: draftInvoices.length,
          sentCount: sentInvoices.length,
          paidTotal,
          outstandingTotal,
        },
        budget: {
          totalBudget,
          totalSpent,
          percentUsed: totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0,
          projectCount: projects.length,
        },
        portfolio: {
          totalTasks,
          completedTasks,
          overdueTasks,
          completionRate: totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0,
        },
        goals: {
          totalObjectives: objectiveList.length,
          onTrack,
          atRisk,
          avgProgress,
        },
      })
    } catch (err) {
      console.error("[PM Dashboard] Error:", err)
    } finally {
      setLoading(false)
    }
  }

  function getWeekStart() {
    const d = new Date()
    d.setDate(d.getDate() - d.getDay())
    d.setHours(0, 0, 0, 0)
    return d.toISOString()
  }

  const fmt = (cents: number) => "$" + (cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Project Management Hub</h1>
          <p className="text-muted-foreground">Cross-project overview and management tools</p>
        </div>
        <UserMenu />
      </div>

      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={`skeleton-${i}`} className="animate-pulse">
              <CardHeader className="pb-2"><div className="h-4 bg-muted rounded w-32" /></CardHeader>
              <CardContent><div className="h-8 bg-muted rounded w-20 mt-2" /></CardContent>
            </Card>
          ))}
        </div>
      )}
      {!loading && data && (
        <>
          {/* Quick Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Clock className="h-4 w-4" />
                  Hours This Week
                </div>
                <div className="text-2xl font-bold mt-1">
                  {data.timeTracking.hoursThisWeek.toFixed(1)}h
                </div>
                <div className="text-xs text-muted-foreground">
                  {data.timeTracking.billableHours.toFixed(1)}h billable
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <DollarSign className="h-4 w-4" />
                  Outstanding
                </div>
                <div className="text-2xl font-bold mt-1">
                  {fmt(data.invoices.outstandingTotal)}
                </div>
                <div className="text-xs text-muted-foreground">
                  {data.invoices.sentCount} sent, {data.invoices.draftCount} draft
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <CheckCircle2 className="h-4 w-4" />
                  Completion Rate
                </div>
                <div className="text-2xl font-bold mt-1">
                  {data.portfolio.completionRate.toFixed(0)}%
                </div>
                <div className="text-xs text-muted-foreground">
                  {data.portfolio.completedTasks}/{data.portfolio.totalTasks} tasks
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Target className="h-4 w-4" />
                  Goals Progress
                </div>
                <div className="text-2xl font-bold mt-1">
                  {data.goals.avgProgress.toFixed(0)}%
                </div>
                <div className="text-xs text-muted-foreground">
                  {data.goals.onTrack} on track, {data.goals.atRisk} at risk
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Detail Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Time Tracking */}
            <Link href="/pm/timesheets">
              <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Clock className="h-4 w-4 text-blue-500" />
                      Time Tracking
                    </CardTitle>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {data.timeTracking.activeTimer && (
                    <Badge variant="outline" className="border-green-500 text-green-600 gap-1">
                      <Timer className="h-3 w-3 animate-pulse" />
                      Timer running
                    </Badge>
                  )}
                  {data.timeTracking.pendingApproval > 0 && (
                    <div className="text-sm text-amber-600">
                      {data.timeTracking.pendingApproval} entries pending approval
                    </div>
                  )}
                  <div className="text-sm text-muted-foreground">
                    {data.timeTracking.hoursThisWeek.toFixed(1)}h logged this week
                  </div>
                </CardContent>
              </Card>
            </Link>

            {/* Invoices */}
            <Link href="/pm/invoices">
              <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <FileText className="h-4 w-4 text-indigo-500" />
                      Invoices
                    </CardTitle>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="text-sm">
                    <span className="font-semibold text-green-600">{fmt(data.invoices.paidTotal)}</span>
                    <span className="text-muted-foreground"> collected</span>
                  </div>
                  {data.invoices.outstandingTotal > 0 && (
                    <div className="text-sm text-amber-600">
                      {fmt(data.invoices.outstandingTotal)} outstanding
                    </div>
                  )}
                  <div className="text-sm text-muted-foreground">
                    {data.invoices.draftCount} drafts ready to send
                  </div>
                </CardContent>
              </Card>
            </Link>

            {/* Budget */}
            <Link href="/pm/budget">
              <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-emerald-500" />
                      Budget
                    </CardTitle>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Progress value={data.budget.percentUsed} className="h-2" />
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      {data.budget.percentUsed.toFixed(0)}% of {fmt(data.budget.totalBudget)}
                    </span>
                    <span className={data.budget.percentUsed > 90 ? "text-red-600 font-medium" : "text-muted-foreground"}>
                      {fmt(data.budget.totalBudget - data.budget.totalSpent)} remaining
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {data.budget.projectCount} tracked projects
                  </div>
                </CardContent>
              </Card>
            </Link>

            {/* Portfolio */}
            <Link href="/pm/portfolio">
              <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-purple-500" />
                      Portfolio
                    </CardTitle>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="text-sm">
                    <span className="font-semibold">{data.portfolio.completedTasks}</span>
                    <span className="text-muted-foreground"> of {data.portfolio.totalTasks} tasks complete</span>
                  </div>
                  {data.portfolio.overdueTasks > 0 && (
                    <div className="flex items-center gap-1 text-sm text-red-600">
                      <AlertCircle className="h-3 w-3" />
                      {data.portfolio.overdueTasks} overdue
                    </div>
                  )}
                  <Progress value={data.portfolio.completionRate} className="h-2" />
                </CardContent>
              </Card>
            </Link>

            {/* Goals & OKRs */}
            <Link href="/pm/goals">
              <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Target className="h-4 w-4 text-orange-500" />
                      Goals & OKRs
                    </CardTitle>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="text-sm">
                    <span className="font-semibold">{data.goals.totalObjectives}</span>
                    <span className="text-muted-foreground"> objectives tracked</span>
                  </div>
                  {data.goals.atRisk > 0 && (
                    <div className="flex items-center gap-1 text-sm text-amber-600">
                      <AlertCircle className="h-3 w-3" />
                      {data.goals.atRisk} at risk
                    </div>
                  )}
                  <Progress value={data.goals.avgProgress} className="h-2" />
                </CardContent>
              </Card>
            </Link>

            {/* Quick Actions */}
            <Card className="h-full">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-cyan-500" />
                  Quick Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Link href="/pm/timesheets">
                  <Button variant="outline" size="sm" className="w-full justify-start gap-2">
                    <Clock className="h-3.5 w-3.5" /> Log time entry
                  </Button>
                </Link>
                <Link href="/pm/invoices">
                  <Button variant="outline" size="sm" className="w-full justify-start gap-2">
                    <FileText className="h-3.5 w-3.5" /> Create invoice
                  </Button>
                </Link>
                <Link href="/pm/goals">
                  <Button variant="outline" size="sm" className="w-full justify-start gap-2">
                    <Target className="h-3.5 w-3.5" /> Set new goal
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </>
      )}
      {!loading && !data && (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            Unable to load dashboard data. Please try refreshing.
          </CardContent>
        </Card>
      )}
    </div>
  )
}

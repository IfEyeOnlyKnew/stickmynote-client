"use client"

import type React from "react"

import { useEffect, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import {
  ChevronLeft,
  BarChart3,
  AlertTriangle,
  Users,
  TrendingUp,
  Clock,
  UserX,
  AlertCircle,
  CalendarClock,
  ArrowRight,
  Download,
  Share2,
  CheckCircle2,
  Lightbulb,
  Filter,
  Play,
  RefreshCw,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import { WORKFLOW_STATUSES, type WorkflowStatus } from "@/types/social-workflow"

interface WorkflowMetrics {
  byStatus: Record<WorkflowStatus, number>
  avgTimeToResolution: number
  stuckThreads: number
  needsOwner: number
  criticalUnresolved: number
  promotedToCalSticks: number
}

interface TrendData {
  date: string
  sticksCreated: number
  resolved: number
  promotedToCalSticks: number
}

interface PadHealth {
  padId: string
  padName: string
  sticksTotal: number
  sticksByStatus: Record<WorkflowStatus, number>
  healthScore: number
  stuckCount: number
  needsOwnerCount: number
}

interface AttentionItems {
  unanswered48h: number
  needsOwner: number
  criticalUnresolved: number
  overdue: number
}

interface DecisionCockpitData {
  metrics: WorkflowMetrics
  trends: TrendData[]
  padHealth: PadHealth[]
  attentionItems: AttentionItems
  totalSticks: number
}

interface DecisionCockpitSidebarProps {
  isOpen: boolean
  onClose: () => void
  onFilterSelect?: (filter: string) => void
}

export function DecisionCockpitSidebar({ isOpen, onClose, onFilterSelect }: DecisionCockpitSidebarProps) {
  const [data, setData] = useState<DecisionCockpitData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("trends")
  const [activeFilter, setActiveFilter] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch("/api/social-analytics/workflow")
      if (response.ok) {
        const result = await response.json()
        setData(result)
      }
    } catch (error) {
      console.error("Error fetching workflow analytics:", error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isOpen) {
      fetchData()
    }
  }, [isOpen, fetchData])

  if (!isOpen) return null

  const handleExport = () => {
    if (!data) return
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `social-hub-metrics-${new Date().toISOString().split("T")[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleFilterClick = (filter: string) => {
    setActiveFilter(filter)
    onFilterSelect?.(filter)
  }

  const statusIcons: Record<WorkflowStatus, React.ReactNode> = {
    idea: <Lightbulb className="h-4 w-4" />,
    triage: <Filter className="h-4 w-4" />,
    in_progress: <Play className="h-4 w-4" />,
    resolved: <CheckCircle2 className="h-4 w-4" />,
  }

  return (
    <div
      className="fixed inset-0 z-[9998] bg-black/50 transition-opacity duration-300"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose()
        }
      }}
    >
      <div
        className={`fixed top-0 right-0 h-full w-[420px] bg-background shadow-2xl transform transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-purple-50 to-blue-50">
          <div className="flex items-center gap-3">
            <BarChart3 className="h-5 w-5 text-purple-600" />
            <h2 className="text-lg font-semibold text-foreground">Decision Cockpit</h2>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={fetchData} title="Refresh">
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleExport} title="Export">
              <Download className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="overflow-y-auto h-[calc(100vh-64px)]">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
            </div>
          ) : data ? (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="w-full grid grid-cols-4 sticky top-0 bg-background z-10 border-b rounded-none">
                <TabsTrigger value="trends" className="text-xs">
                  Trends
                </TabsTrigger>
                <TabsTrigger value="health" className="text-xs">
                  Health
                </TabsTrigger>
                <TabsTrigger value="attention" className="text-xs">
                  Attention
                  {data.attentionItems.unanswered48h + data.attentionItems.needsOwner > 0 && (
                    <Badge
                      variant="destructive"
                      className="ml-1 h-4 w-4 p-0 text-[10px] flex items-center justify-center"
                    >
                      !
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="actions" className="text-xs">
                  Actions
                </TabsTrigger>
              </TabsList>

              {/* Trends Tab */}
              <TabsContent value="trends" className="p-4 space-y-4 mt-0">
                {/* Status Distribution */}
                <Card className="p-4">
                  <h3 className="font-medium text-sm mb-3 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-purple-600" />
                    Workflow Status Distribution
                  </h3>
                  <div className="space-y-3">
                    {(["idea", "triage", "in_progress", "resolved"] as WorkflowStatus[]).map((status) => {
                      const config = WORKFLOW_STATUSES[status]
                      const count = data.metrics.byStatus[status]
                      const percentage = data.totalSticks > 0 ? Math.round((count / data.totalSticks) * 100) : 0

                      return (
                        <div key={status} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <div className={cn("flex items-center gap-2", config.color)}>
                              {statusIcons[status]}
                              <span>{config.label}</span>
                            </div>
                            <span className="font-medium">{count}</span>
                          </div>
                          <Progress value={percentage} className="h-2" />
                        </div>
                      )
                    })}
                  </div>
                </Card>

                {/* Sparkline Cards */}
                <div className="grid grid-cols-2 gap-3">
                  <Card className="p-3 bg-blue-50 border-blue-200">
                    <div className="text-xs text-blue-700 font-medium">Avg Resolution</div>
                    <div className="text-2xl font-bold text-blue-600">
                      {data.metrics.avgTimeToResolution.toFixed(1)}h
                    </div>
                    <div className="text-xs text-blue-600">average time</div>
                  </Card>
                  <Card className="p-3 bg-purple-50 border-purple-200">
                    <div className="text-xs text-purple-700 font-medium">Promoted</div>
                    <div className="text-2xl font-bold text-purple-600">{data.metrics.promotedToCalSticks}</div>
                    <div className="text-xs text-purple-600">to CalSticks</div>
                  </Card>
                </div>

                {/* Weekly Activity Chart */}
                {data.trends.length > 0 && (
                  <Card className="p-4">
                    <h3 className="font-medium text-sm mb-3 flex items-center gap-2">
                      <Clock className="h-4 w-4 text-blue-600" />
                      Weekly Activity
                    </h3>
                    <div className="space-y-2">
                      {data.trends.map((day) => {
                        const maxValue = Math.max(
                          ...data.trends.map((d) => d.sticksCreated + d.resolved + d.promotedToCalSticks),
                        )
                        const total = day.sticksCreated + day.resolved + day.promotedToCalSticks

                        return (
                          <div key={day.date} className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <span className="text-muted-foreground">{day.date}</span>
                              <span className="font-medium">{total} activities</span>
                            </div>
                            <div className="flex gap-0.5 h-4 bg-muted rounded overflow-hidden">
                              <div
                                className="bg-blue-500"
                                style={{ width: `${(day.sticksCreated / (maxValue || 1)) * 100}%` }}
                                title={`${day.sticksCreated} created`}
                              />
                              <div
                                className="bg-green-500"
                                style={{ width: `${(day.resolved / (maxValue || 1)) * 100}%` }}
                                title={`${day.resolved} resolved`}
                              />
                              <div
                                className="bg-purple-500"
                                style={{ width: `${(day.promotedToCalSticks / (maxValue || 1)) * 100}%` }}
                                title={`${day.promotedToCalSticks} promoted`}
                              />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    <div className="flex gap-4 mt-3 text-xs">
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-blue-500" />
                        <span>Created</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-green-500" />
                        <span>Resolved</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-purple-500" />
                        <span>Promoted</span>
                      </div>
                    </div>
                  </Card>
                )}
              </TabsContent>

              {/* Health Tab */}
              <TabsContent value="health" className="p-4 space-y-4 mt-0">
                <Card className="p-4">
                  <h3 className="font-medium text-sm mb-3 flex items-center gap-2">
                    <Users className="h-4 w-4 text-green-600" />
                    Pad Health Overview
                  </h3>
                  {data.padHealth.length > 0 ? (
                    <div className="space-y-3">
                      {data.padHealth.map((pad) => (
                        <div key={pad.padId} className="border rounded-lg p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-sm truncate">{pad.padName}</span>
                            <Badge
                              variant={
                                pad.healthScore >= 70 ? "default" : pad.healthScore >= 40 ? "secondary" : "destructive"
                              }
                              className="text-xs"
                            >
                              {pad.healthScore}%
                            </Badge>
                          </div>
                          <Progress
                            value={pad.healthScore}
                            className={cn(
                              "h-2",
                              pad.healthScore >= 70
                                ? "[&>div]:bg-green-500"
                                : pad.healthScore >= 40
                                  ? "[&>div]:bg-yellow-500"
                                  : "[&>div]:bg-red-500",
                            )}
                          />
                          <div className="flex gap-2 text-xs text-muted-foreground">
                            <span>{pad.sticksTotal} sticks</span>
                            <span>|</span>
                            <span>{pad.sticksByStatus.resolved} resolved</span>
                            {pad.stuckCount > 0 && (
                              <>
                                <span>|</span>
                                <span className="text-orange-600">{pad.stuckCount} stuck</span>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">No pads with activity yet</p>
                  )}
                </Card>
              </TabsContent>

              {/* Attention Tab */}
              <TabsContent value="attention" className="p-4 space-y-4 mt-0">
                <Card className="p-4 space-y-3">
                  <h3 className="font-medium text-sm flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-orange-600" />
                    Items Needing Attention
                  </h3>

                  <button
                    onClick={() => handleFilterClick("unanswered48h")}
                    className={cn(
                      "w-full flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors",
                      activeFilter === "unanswered48h" && "ring-2 ring-purple-500 bg-purple-50",
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-full bg-orange-100">
                        <Clock className="h-4 w-4 text-orange-600" />
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-medium">Unanswered {"> "}48h</p>
                        <p className="text-xs text-muted-foreground">No replies in 2+ days</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {activeFilter === "unanswered48h" && <CheckCircle2 className="h-4 w-4 text-purple-600" />}
                      <Badge variant={data.attentionItems.unanswered48h > 0 ? "destructive" : "secondary"}>
                        {data.attentionItems.unanswered48h}
                      </Badge>
                    </div>
                  </button>

                  <button
                    onClick={() => handleFilterClick("needsOwner")}
                    className={cn(
                      "w-full flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors",
                      activeFilter === "needsOwner" && "ring-2 ring-purple-500 bg-purple-50",
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-full bg-purple-100">
                        <UserX className="h-4 w-4 text-purple-600" />
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-medium">Needs Owner</p>
                        <p className="text-xs text-muted-foreground">No one assigned</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {activeFilter === "needsOwner" && <CheckCircle2 className="h-4 w-4 text-purple-600" />}
                      <Badge variant={data.attentionItems.needsOwner > 0 ? "destructive" : "secondary"}>
                        {data.attentionItems.needsOwner}
                      </Badge>
                    </div>
                  </button>

                  <button
                    onClick={() => handleFilterClick("criticalUnresolved")}
                    className={cn(
                      "w-full flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors",
                      activeFilter === "criticalUnresolved" && "ring-2 ring-purple-500 bg-purple-50",
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-full bg-red-100">
                        <AlertCircle className="h-4 w-4 text-red-600" />
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-medium">Critical Unresolved</p>
                        <p className="text-xs text-muted-foreground">In progress {">"} 7 days</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {activeFilter === "criticalUnresolved" && <CheckCircle2 className="h-4 w-4 text-purple-600" />}
                      <Badge variant={data.attentionItems.criticalUnresolved > 0 ? "destructive" : "secondary"}>
                        {data.attentionItems.criticalUnresolved}
                      </Badge>
                    </div>
                  </button>

                  <button
                    onClick={() => handleFilterClick("overdue")}
                    className={cn(
                      "w-full flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors",
                      activeFilter === "overdue" && "ring-2 ring-purple-500 bg-purple-50",
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-full bg-amber-100">
                        <CalendarClock className="h-4 w-4 text-amber-600" />
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-medium">Overdue</p>
                        <p className="text-xs text-muted-foreground">Past due date</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {activeFilter === "overdue" && <CheckCircle2 className="h-4 w-4 text-purple-600" />}
                      <Badge variant={data.attentionItems.overdue > 0 ? "destructive" : "secondary"}>
                        {data.attentionItems.overdue}
                      </Badge>
                    </div>
                  </button>
                </Card>
              </TabsContent>

              {/* Actions Tab */}
              <TabsContent value="actions" className="p-4 space-y-4 mt-0">
                <Card className="p-4 space-y-3">
                  <h3 className="font-medium text-sm flex items-center gap-2">
                    <ArrowRight className="h-4 w-4 text-blue-600" />
                    Quick Actions
                  </h3>

                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start bg-transparent",
                      activeFilter === "needsOwner" && "ring-2 ring-purple-500 bg-purple-50",
                    )}
                    onClick={() => handleFilterClick("needsOwner")}
                  >
                    <UserX className="h-4 w-4 mr-2" />
                    Assign Owners to {data.attentionItems.needsOwner} Items
                    {activeFilter === "needsOwner" && <CheckCircle2 className="h-4 w-4 ml-auto text-purple-600" />}
                  </Button>

                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start bg-transparent",
                      activeFilter === "triage" && "ring-2 ring-purple-500 bg-purple-50",
                    )}
                    onClick={() => handleFilterClick("triage")}
                  >
                    <Filter className="h-4 w-4 mr-2" />
                    Triage {data.metrics.byStatus.idea} Ideas
                    {activeFilter === "triage" && <CheckCircle2 className="h-4 w-4 ml-auto text-purple-600" />}
                  </Button>

                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start bg-transparent",
                      activeFilter === "criticalUnresolved" && "ring-2 ring-purple-500 bg-purple-50",
                    )}
                    onClick={() => handleFilterClick("criticalUnresolved")}
                  >
                    <AlertCircle className="h-4 w-4 mr-2" />
                    Escalate {data.attentionItems.criticalUnresolved} Critical Items
                    {activeFilter === "criticalUnresolved" && (
                      <CheckCircle2 className="h-4 w-4 ml-auto text-purple-600" />
                    )}
                  </Button>
                </Card>

                <Card className="p-4 space-y-3">
                  <h3 className="font-medium text-sm flex items-center gap-2">
                    <Share2 className="h-4 w-4 text-green-600" />
                    Export & Share
                  </h3>

                  <Button variant="outline" className="w-full justify-start bg-transparent" onClick={handleExport}>
                    <Download className="h-4 w-4 mr-2" />
                    Export Metrics (JSON)
                  </Button>

                  <Button
                    variant="outline"
                    className="w-full justify-start bg-transparent"
                    onClick={() => {
                      const summary = `Social Hub Metrics:\n- ${data.totalSticks} total sticks\n- ${data.metrics.byStatus.resolved} resolved\n- ${data.metrics.promotedToCalSticks} promoted to CalSticks\n- ${data.attentionItems.unanswered48h} need attention`
                      navigator.clipboard.writeText(summary)
                    }}
                  >
                    <Share2 className="h-4 w-4 mr-2" />
                    Copy Summary to Clipboard
                  </Button>
                </Card>
              </TabsContent>
            </Tabs>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 px-4">
              <BarChart3 className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground text-center">
                No workflow data available yet. Start creating and managing social sticks to see analytics.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

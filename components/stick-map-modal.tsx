"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  Loader2,
  MessageSquare,
  Video,
  CalendarCheck,
  BookOpen,
  StickyNote,
} from "lucide-react"

// ============================================================================
// Types
// ============================================================================

interface StickMapModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  stickId: string
  stickTopic?: string
  stickContent?: string
  stickColor?: string
  onNodeClick?: (nodeId: string, data?: { chatId?: string; meetingId?: string }) => void
}

interface ComponentCounts {
  calsticks: { total: number; completed: number; notCompleted: number }
  noted: { total: number }
  chats: { total: number; chatId?: string | null }
  videoRooms: { total: number; meetingId?: string | null }
}

interface MapNode {
  id: string
  label: string
  icon: React.ReactNode
  count: number
  subtitle?: string
  color: string
  bgColor: string
  borderColor: string
  data?: { chatId?: string; meetingId?: string }
}

// ============================================================================
// Constants
// ============================================================================

const NODE_RADIUS = 54
const CENTER_RADIUS = 62
const ORBIT_RADIUS = 160

// ============================================================================
// Helpers
// ============================================================================

function buildNodes(counts: ComponentCounts): MapNode[] {
  return [
    {
      id: "calsticks",
      label: "CalSticks",
      icon: <CalendarCheck className="h-5 w-5" />,
      count: counts.calsticks.total,
      subtitle: counts.calsticks.total > 0
        ? `${counts.calsticks.completed} done, ${counts.calsticks.notCompleted} open`
        : undefined,
      color: "text-orange-700",
      bgColor: "bg-orange-50",
      borderColor: "border-orange-300",
    },
    {
      id: "noted",
      label: "Noted",
      icon: <BookOpen className="h-5 w-5" />,
      count: counts.noted.total,
      color: "text-purple-700",
      bgColor: "bg-purple-50",
      borderColor: "border-purple-300",
    },
    {
      id: "chats",
      label: "Chat",
      icon: <MessageSquare className="h-5 w-5" />,
      count: counts.chats.total,
      color: "text-green-700",
      bgColor: "bg-green-50",
      borderColor: "border-green-300",
      data: counts.chats.chatId ? { chatId: counts.chats.chatId } : undefined,
    },
    {
      id: "videoRooms",
      label: "Video",
      icon: <Video className="h-5 w-5" />,
      count: counts.videoRooms.total,
      color: "text-red-700",
      bgColor: "bg-red-50",
      borderColor: "border-red-300",
      data: counts.videoRooms.meetingId ? { meetingId: counts.videoRooms.meetingId } : undefined,
    },
  ]
}

function getNodePosition(index: number, total: number, orbitRadius: number) {
  const angle = (index / total) * 2 * Math.PI - Math.PI / 2
  return {
    x: Math.cos(angle) * orbitRadius,
    y: Math.sin(angle) * orbitRadius,
  }
}

// ============================================================================
// Sub-components
// ============================================================================

function ConnectionLine({ x1, y1, x2, y2, hasData }: Readonly<{ x1: number; y1: number; x2: number; y2: number; hasData: boolean }>) {
  return (
    <line
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      stroke={hasData ? "currentColor" : "#d1d5db"}
      strokeWidth={hasData ? 2 : 1}
      strokeDasharray={hasData ? "none" : "4 4"}
      className={hasData ? "text-gray-400" : ""}
      style={{ transition: "all 0.3s ease" }}
    />
  )
}

function CenterNode({ topic, color }: Readonly<{ topic: string; color: string }>) {
  return (
    <div
      className="absolute flex flex-col items-center justify-center rounded-full border-[3px] shadow-lg z-10 cursor-default"
      style={{
        width: CENTER_RADIUS * 2,
        height: CENTER_RADIUS * 2,
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -50%)",
        borderColor: color || "#6366f1",
        background: `linear-gradient(135deg, ${color || "#6366f1"}15, ${color || "#6366f1"}30)`,
      }}
    >
      <StickyNote className="h-6 w-6 mb-1" style={{ color: color || "#6366f1" }} />
      <span className="text-xs font-semibold text-center px-2 leading-tight line-clamp-2 max-w-[100px]">
        {topic || "Stick"}
      </span>
    </div>
  )
}

function getOrbitNodeClasses(hasData: boolean, node: MapNode) {
  const base = "absolute flex flex-col items-center justify-center rounded-full border-2 transition-all duration-300 hover:scale-110 hover:shadow-lg z-10"
  const cursor = hasData ? "cursor-pointer" : "cursor-default"
  const bg = hasData ? node.bgColor : "bg-gray-50"
  const border = hasData ? node.borderColor : "border-gray-200 border-dashed"
  const opacity = hasData ? "" : "opacity-50"
  return `${base} ${cursor} ${bg} ${border} ${opacity}`
}

function OrbitNodeTooltip({ node, hasData }: Readonly<{ node: MapNode; hasData: boolean }>) {
  if (!hasData) {
    return <p className="text-muted-foreground">No {node.label.toLowerCase()} yet</p>
  }
  return (
    <>
      <p className="text-muted-foreground">
        {node.count} {node.count === 1 ? "item" : "items"}
      </p>
      {node.subtitle && (
        <p className="text-muted-foreground text-xs">{node.subtitle}</p>
      )}
    </>
  )
}

function OrbitNode({ node, position, index, onClick }: Readonly<{ node: MapNode; position: { x: number; y: number }; index: number; onClick?: (nodeId: string, data?: { chatId?: string; meetingId?: string }) => void }>) {
  const hasData = node.count > 0
  const isClickable = hasData && !!onClick
  const colorClass = hasData ? node.color : "text-gray-400"

  const handleClick = isClickable ? () => onClick(node.id, node.data) : undefined
  const handleKeyDown = isClickable ? (e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") onClick(node.id, node.data) } : undefined

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            disabled={!isClickable}
            onClick={handleClick}
            onKeyDown={handleKeyDown}
            className={getOrbitNodeClasses(hasData, node)}
            style={{
              width: NODE_RADIUS * 2,
              height: NODE_RADIUS * 2,
              left: "50%",
              top: "50%",
              transform: `translate(calc(-50% + ${position.x}px), calc(-50% + ${position.y}px))`,
              animationDelay: `${index * 80}ms`,
            }}
          >
            <div className={colorClass}>{node.icon}</div>
            <span className={`text-[10px] font-semibold mt-0.5 ${colorClass}`}>
              {node.label}
            </span>
            {hasData && (
              <span className={`text-[10px] font-bold ${node.color}`}>
                {node.count}
              </span>
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent className="z-[10002]" sideOffset={8}>
          <div className="text-sm">
            <p className="font-semibold">{node.label}</p>
            <OrbitNodeTooltip node={node} hasData={hasData} />
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

// ============================================================================
// Main Component
// ============================================================================

export function StickMapModal({
  open,
  onOpenChange,
  stickId,
  stickTopic,
  stickContent,
  stickColor,
  onNodeClick,
}: Readonly<StickMapModalProps>) {
  const [loading, setLoading] = useState(false)
  const [counts, setCounts] = useState<ComponentCounts | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const fetchMapData = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/sticks/${stickId}/map`)
      if (!response.ok) throw new Error("Failed to fetch map data")
      const data = await response.json()
      setCounts(data.components)
    } catch (error) {
      console.error("Error fetching stick map data:", error)
    } finally {
      setLoading(false)
    }
  }, [stickId])

  useEffect(() => {
    if (open && stickId) {
      fetchMapData()
    }
  }, [open, stickId, fetchMapData])

  const nodes = counts ? buildNodes(counts) : []
  const canvasSize = (ORBIT_RADIUS + NODE_RADIUS) * 2 + 40
  const center = canvasSize / 2

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[520px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Stick Map</DialogTitle>
          <DialogDescription>
            {stickTopic || "Stick"} — connected components
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 flex items-center justify-center py-4 overflow-auto">
          {loading && (
            <div className="flex flex-col items-center gap-3 py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Mapping components...</p>
            </div>
          )}
          {!loading && counts && (
            <div
              ref={containerRef}
              className="relative mx-auto"
              style={{ width: canvasSize, height: canvasSize }}
            >
              {/* SVG connection lines */}
              <svg
                className="absolute inset-0 pointer-events-none"
                width={canvasSize}
                height={canvasSize}
              >
                {nodes.map((node, i) => {
                  const pos = getNodePosition(i, nodes.length, ORBIT_RADIUS)
                  return (
                    <ConnectionLine
                      key={node.id}
                      x1={center}
                      y1={center}
                      x2={center + pos.x}
                      y2={center + pos.y}
                      hasData={node.count > 0}
                    />
                  )
                })}
              </svg>

              {/* Center stick node */}
              <CenterNode topic={stickTopic || "Stick"} color={stickColor || "#6366f1"} />

              {/* Orbit nodes */}
              {nodes.map((node, i) => {
                const pos = getNodePosition(i, nodes.length, ORBIT_RADIUS)
                return (
                  <OrbitNode key={node.id} node={node} position={pos} index={i} onClick={onNodeClick} />
                )
              })}
            </div>
          )}
          {!loading && !counts && (
            <p className="text-sm text-muted-foreground py-12">Failed to load map data</p>
          )}
        </div>

        {/* Legend */}
        {counts && !loading && (
          <div className="border-t pt-3 pb-1">
            <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-0.5 bg-gray-400" />
                <span>Connected</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-0.5 border-t border-dashed border-gray-300" />
                <span>Empty</span>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

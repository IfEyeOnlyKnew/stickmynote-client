"use client"

import React, { useRef, useState, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Pencil,
  Square,
  Circle,
  Type,
  Eraser,
  Undo2,
  Redo2,
  Trash2,
  Download,
  Minus,
} from "lucide-react"

interface Point {
  x: number
  y: number
}

interface DrawAction {
  tool: string
  color: string
  lineWidth: number
  points: Point[]
  text?: string
}

interface WhiteboardProps {
  onDrawAction?: (action: DrawAction) => void
  incomingActions?: DrawAction[]
  className?: string
}

const COLORS = ["#000000", "#EF4444", "#3B82F6", "#10B981", "#F59E0B", "#8B5CF6", "#EC4899", "#FFFFFF"]
const LINE_WIDTHS = [2, 4, 8, 16]

// Tool-specific draw functions extracted to reduce cognitive complexity
const DRAW_TOOL_MAP: Record<string, (ctx: CanvasRenderingContext2D, action: DrawAction) => void> = {
  pen: (ctx, action) => {
    if (action.points.length < 2) return
    ctx.beginPath()
    ctx.moveTo(action.points[0].x, action.points[0].y)
    for (let i = 1; i < action.points.length; i++) {
      ctx.lineTo(action.points[i].x, action.points[i].y)
    }
    ctx.stroke()
  },
  eraser: (ctx, action) => {
    if (action.points.length < 2) return
    ctx.beginPath()
    ctx.moveTo(action.points[0].x, action.points[0].y)
    for (let i = 1; i < action.points.length; i++) {
      ctx.lineTo(action.points[i].x, action.points[i].y)
    }
    ctx.stroke()
  },
  line: (ctx, action) => {
    if (action.points.length < 2) return
    const start = action.points[0]
    const end = action.points.at(-1)!
    ctx.beginPath()
    ctx.moveTo(start.x, start.y)
    ctx.lineTo(end.x, end.y)
    ctx.stroke()
  },
  rect: (ctx, action) => {
    if (action.points.length < 2) return
    const start = action.points[0]
    const end = action.points.at(-1)!
    ctx.strokeRect(start.x, start.y, end.x - start.x, end.y - start.y)
  },
  circle: (ctx, action) => {
    if (action.points.length < 2) return
    const start = action.points[0]
    const end = action.points.at(-1)!
    const rx = Math.abs(end.x - start.x) / 2
    const ry = Math.abs(end.y - start.y) / 2
    const cx = (start.x + end.x) / 2
    const cy = (start.y + end.y) / 2
    ctx.beginPath()
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
    ctx.stroke()
  },
  text: (ctx, action) => {
    if (!action.text) return
    ctx.font = `${action.lineWidth * 4}px sans-serif`
    ctx.fillText(action.text, action.points[0].x, action.points[0].y)
  },
}

export function Whiteboard({ onDrawAction, incomingActions, className }: Readonly<WhiteboardProps>) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [tool, setTool] = useState<"pen" | "line" | "rect" | "circle" | "eraser" | "text">("pen")
  const [color, setColor] = useState("#000000")
  const [lineWidth, setLineWidth] = useState(4)
  const [currentPoints, setCurrentPoints] = useState<Point[]>([])
  const [history, setHistory] = useState<DrawAction[]>([])
  const [redoStack, setRedoStack] = useState<DrawAction[]>([])

  // Canvas resize
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const parent = canvas.parentElement
    if (!parent) return

    const resize = () => {
      const rect = parent.getBoundingClientRect()
      canvas.width = rect.width
      canvas.height = rect.height
      redrawAll()
    }

    resize()
    window.addEventListener("resize", resize)
    return () => window.removeEventListener("resize", resize)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Process incoming actions from other users
  useEffect(() => {
    if (incomingActions && incomingActions.length > 0) {
      const lastAction = incomingActions.at(-1)!
      setHistory((prev) => [...prev, lastAction])
      drawAction(lastAction)
    }
  }, [incomingActions]) // eslint-disable-line react-hooks/exhaustive-deps

  const getCanvasPoint = useCallback((e: React.MouseEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    }
  }, [])

  const drawAction = useCallback((action: DrawAction) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    ctx.strokeStyle = action.tool === "eraser" ? "#FFFFFF" : action.color
    ctx.fillStyle = action.color
    ctx.lineWidth = action.tool === "eraser" ? action.lineWidth * 4 : action.lineWidth
    ctx.lineCap = "round"
    ctx.lineJoin = "round"

    const drawFn = DRAW_TOOL_MAP[action.tool]
    if (drawFn) {
      drawFn(ctx, action)
    }
  }, [])

  const redrawAll = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.fillStyle = "#FFFFFF"
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    for (const action of history) {
      drawAction(action)
    }
  }, [history, drawAction])

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (tool === "text") {
      const point = getCanvasPoint(e)
      const text = prompt("Enter text:")
      if (text) {
        const action: DrawAction = { tool, color, lineWidth, points: [point], text }
        setHistory((prev) => [...prev, action])
        setRedoStack([])
        drawAction(action)
        onDrawAction?.(action)
      }
      return
    }
    setIsDrawing(true)
    const point = getCanvasPoint(e)
    setCurrentPoints([point])
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return
    const point = getCanvasPoint(e)
    setCurrentPoints((prev) => [...prev, point])

    // Live drawing for pen/eraser only
    if (tool !== "pen" && tool !== "eraser") return

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    const points = [...currentPoints, point]
    if (points.length < 2) return
    ctx.strokeStyle = tool === "eraser" ? "#FFFFFF" : color
    ctx.lineWidth = tool === "eraser" ? lineWidth * 4 : lineWidth
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    ctx.beginPath()
    ctx.moveTo(points.at(-2)!.x, points.at(-2)!.y)
    ctx.lineTo(point.x, point.y)
    ctx.stroke()
  }

  const handleMouseUp = () => {
    if (!isDrawing) return
    setIsDrawing(false)

    if (currentPoints.length > 0) {
      const action: DrawAction = { tool, color, lineWidth, points: currentPoints }
      setHistory((prev) => [...prev, action])
      setRedoStack([])
      onDrawAction?.(action)

      // For shapes, redraw to show final result
      if (tool !== "pen" && tool !== "eraser") {
        redrawAll()
        drawAction(action)
      }
    }
    setCurrentPoints([])
  }

  const undo = () => {
    if (history.length === 0) return
    const last = history.at(-1)!
    setHistory((prev) => prev.slice(0, -1))
    setRedoStack((prev) => [...prev, last])
    // Redraw without last action
    setTimeout(() => redrawAll(), 0)
  }

  const redo = () => {
    if (redoStack.length === 0) return
    const action = redoStack[redoStack.length - 1]
    setRedoStack((prev) => prev.slice(0, -1))
    setHistory((prev) => [...prev, action])
    drawAction(action)
  }

  const clearAll = () => {
    setHistory([])
    setRedoStack([])
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.fillStyle = "#FFFFFF"
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }

  const downloadCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const link = document.createElement("a")
    link.download = "whiteboard.png"
    link.href = canvas.toDataURL("image/png")
    link.click()
  }

  return (
    <div className={`flex flex-col h-full bg-white ${className || ""}`}>
      {/* Toolbar */}
      <div className="flex items-center gap-2 p-2 border-b bg-gray-50 flex-wrap">
        {/* Tools */}
        <div className="flex gap-0.5 border-r pr-2">
          {[
            { id: "pen" as const, icon: Pencil, label: "Pen" },
            { id: "line" as const, icon: Minus, label: "Line" },
            { id: "rect" as const, icon: Square, label: "Rectangle" },
            { id: "circle" as const, icon: Circle, label: "Circle" },
            { id: "text" as const, icon: Type, label: "Text" },
            { id: "eraser" as const, icon: Eraser, label: "Eraser" },
          ].map(({ id, icon: Icon, label }) => (
            <Button
              key={id}
              variant={tool === id ? "default" : "ghost"}
              size="icon"
              className="h-8 w-8"
              onClick={() => setTool(id)}
              title={label}
            >
              <Icon className="w-4 h-4" />
            </Button>
          ))}
        </div>

        {/* Colors */}
        <div className="flex gap-1 border-r pr-2">
          {COLORS.map((c) => (
            <button
              type="button"
              key={c}
              className={`w-6 h-6 rounded-full border-2 transition-transform ${
                color === c ? "scale-125 border-indigo-500" : "border-gray-300 hover:scale-110"
              }`}
              style={{ backgroundColor: c }}
              onClick={() => setColor(c)}
              aria-label={`Select color ${c}`}
            />
          ))}
        </div>

        {/* Line width */}
        <div className="flex gap-1 border-r pr-2">
          {LINE_WIDTHS.map((w) => (
            <button
              type="button"
              key={w}
              className={`w-8 h-8 rounded flex items-center justify-center ${
                lineWidth === w ? "bg-indigo-100" : "hover:bg-gray-100"
              }`}
              onClick={() => setLineWidth(w)}
              aria-label={`Line width ${w}`}
            >
              <div
                className="rounded-full bg-current"
                style={{ width: Math.min(w + 2, 16), height: Math.min(w + 2, 16), color }}
              />
            </button>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-0.5">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={undo} title="Undo" disabled={history.length === 0}>
            <Undo2 className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={redo} title="Redo" disabled={redoStack.length === 0}>
            <Redo2 className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={clearAll} title="Clear">
            <Trash2 className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={downloadCanvas} title="Download">
            <Download className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 relative overflow-hidden">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 cursor-crosshair"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        />
      </div>
    </div>
  )
}

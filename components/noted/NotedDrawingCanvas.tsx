"use client"

import { useRef, useState, useCallback, useEffect } from "react"
import {
  Pencil, Eraser, Square, Circle, Minus as LineIcon,
  Type, Undo, Redo, Download, Trash2, Palette,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Slider } from "@/components/ui/slider"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

type Tool = "pen" | "eraser" | "line" | "rect" | "circle" | "text"

interface Point {
  x: number
  y: number
}

interface DrawAction {
  tool: Tool
  color: string
  lineWidth: number
  points?: Point[]
  start?: Point
  end?: Point
  text?: string
}

const COLORS = [
  "#000000", "#ffffff", "#ef4444", "#f97316", "#eab308",
  "#22c55e", "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899",
]

interface NotedDrawingCanvasProps {
  open: boolean
  onClose: () => void
  onSave: (dataUrl: string) => void
  initialImage?: string
}

export function NotedDrawingCanvas({
  open,
  onClose,
  onSave,
  initialImage,
}: Readonly<NotedDrawingCanvasProps>) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [activeTool, setActiveTool] = useState<Tool>("pen")
  const [activeColor, setActiveColor] = useState("#000000")
  const [lineWidth, setLineWidth] = useState(2)
  const [isDrawing, setIsDrawing] = useState(false)
  const [history, setHistory] = useState<ImageData[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [textInput, setTextInput] = useState("")
  const [textPosition, setTextPosition] = useState<Point | null>(null)
  const startPoint = useRef<Point | null>(null)
  const snapshotRef = useRef<ImageData | null>(null)

  // Initialize canvas
  useEffect(() => {
    if (!open || !canvasRef.current) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    canvas.width = 900
    canvas.height = 600

    ctx.fillStyle = "#ffffff"
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    if (initialImage) {
      const img = new globalThis.Image()
      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        saveToHistory()
      }
      img.src = initialImage
    } else {
      saveToHistory()
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const saveToHistory = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    setHistory((prev) => {
      const newHistory = prev.slice(0, historyIndex + 1)
      newHistory.push(imageData)
      return newHistory
    })
    setHistoryIndex((prev) => prev + 1)
  }, [historyIndex])

  const undo = useCallback(() => {
    if (historyIndex <= 0) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    const newIndex = historyIndex - 1
    ctx.putImageData(history[newIndex], 0, 0)
    setHistoryIndex(newIndex)
  }, [history, historyIndex])

  const redo = useCallback(() => {
    if (historyIndex >= history.length - 1) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    const newIndex = historyIndex + 1
    ctx.putImageData(history[newIndex], 0, 0)
    setHistoryIndex(newIndex)
  }, [history, historyIndex])

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.fillStyle = "#ffffff"
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    saveToHistory()
  }, [saveToHistory])

  const getCanvasPoint = useCallback((e: React.MouseEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    }
  }, [])

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const point = getCanvasPoint(e)

    if (activeTool === "text") {
      setTextPosition(point)
      return
    }

    setIsDrawing(true)
    startPoint.current = point

    if (activeTool === "pen" || activeTool === "eraser") {
      ctx.beginPath()
      ctx.moveTo(point.x, point.y)
      ctx.strokeStyle = activeTool === "eraser" ? "#ffffff" : activeColor
      ctx.lineWidth = activeTool === "eraser" ? lineWidth * 5 : lineWidth
      ctx.lineCap = "round"
      ctx.lineJoin = "round"
    }

    // Save snapshot for shape tools (so we can redraw preview)
    if (["line", "rect", "circle"].includes(activeTool)) {
      snapshotRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height)
    }
  }, [activeTool, activeColor, lineWidth, getCanvasPoint])

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const point = getCanvasPoint(e)

    if (activeTool === "pen" || activeTool === "eraser") {
      ctx.lineTo(point.x, point.y)
      ctx.stroke()
    } else if (startPoint.current && snapshotRef.current) {
      // Restore snapshot and draw shape preview
      ctx.putImageData(snapshotRef.current, 0, 0)
      ctx.strokeStyle = activeColor
      ctx.lineWidth = lineWidth
      ctx.lineCap = "round"

      const sp = startPoint.current
      if (activeTool === "line") {
        ctx.beginPath()
        ctx.moveTo(sp.x, sp.y)
        ctx.lineTo(point.x, point.y)
        ctx.stroke()
      } else if (activeTool === "rect") {
        ctx.strokeRect(sp.x, sp.y, point.x - sp.x, point.y - sp.y)
      } else if (activeTool === "circle") {
        const rx = Math.abs(point.x - sp.x) / 2
        const ry = Math.abs(point.y - sp.y) / 2
        const cx = sp.x + (point.x - sp.x) / 2
        const cy = sp.y + (point.y - sp.y) / 2
        ctx.beginPath()
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
        ctx.stroke()
      }
    }
  }, [isDrawing, activeTool, activeColor, lineWidth, getCanvasPoint])

  const handleMouseUp = useCallback(() => {
    if (isDrawing) {
      setIsDrawing(false)
      startPoint.current = null
      snapshotRef.current = null
      saveToHistory()
    }
  }, [isDrawing, saveToHistory])

  const handleTextSubmit = useCallback(() => {
    if (!textPosition || !textInput.trim()) {
      setTextPosition(null)
      setTextInput("")
      return
    }
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    ctx.font = `${lineWidth * 8}px sans-serif`
    ctx.fillStyle = activeColor
    ctx.fillText(textInput, textPosition.x, textPosition.y)
    saveToHistory()
    setTextPosition(null)
    setTextInput("")
  }, [textPosition, textInput, activeColor, lineWidth, saveToHistory])

  const handleDownload = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const link = document.createElement("a")
    link.download = "drawing.png"
    link.href = canvas.toDataURL("image/png")
    link.click()
  }, [])

  const handleSave = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dataUrl = canvas.toDataURL("image/png")
    onSave(dataUrl)
    onClose()
  }, [onSave, onClose])

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[980px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Drawing Canvas</DialogTitle>
        </DialogHeader>

        {/* Toolbar */}
        <div className="flex items-center gap-1 flex-wrap">
          {/* Tools */}
          {([
            { tool: "pen" as Tool, icon: Pencil, label: "Pen" },
            { tool: "eraser" as Tool, icon: Eraser, label: "Eraser" },
            { tool: "line" as Tool, icon: LineIcon, label: "Line" },
            { tool: "rect" as Tool, icon: Square, label: "Rectangle" },
            { tool: "circle" as Tool, icon: Circle, label: "Circle" },
            { tool: "text" as Tool, icon: Type, label: "Text" },
          ]).map(({ tool, icon: Icon, label }) => (
            <Button
              key={tool}
              variant={activeTool === tool ? "default" : "ghost"}
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => setActiveTool(tool)}
              title={label}
            >
              <Icon className="h-4 w-4" />
            </Button>
          ))}

          <div className="w-px h-5 bg-border mx-1" />

          {/* Colors */}
          {COLORS.map((color) => (
            <button
              type="button"
              key={color}
              onClick={() => setActiveColor(color)}
              aria-label={`Select color ${color}`}
              className={cn(
                "w-6 h-6 rounded-full border transition-all",
                activeColor === color && "ring-2 ring-offset-1 ring-primary"
              )}
              style={{ backgroundColor: color }}
            />
          ))}

          <div className="w-px h-5 bg-border mx-1" />

          {/* Line width */}
          <div className="flex items-center gap-2 w-28">
            <Palette className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <Slider
              value={[lineWidth]}
              onValueChange={([v]) => setLineWidth(v)}
              min={1}
              max={10}
              step={1}
              className="flex-1"
            />
          </div>

          <div className="w-px h-5 bg-border mx-1" />

          {/* Actions */}
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={undo} title="Undo" disabled={historyIndex <= 0}>
            <Undo className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={redo} title="Redo" disabled={historyIndex >= history.length - 1}>
            <Redo className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={clearCanvas} title="Clear">
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={handleDownload} title="Download PNG">
            <Download className="h-4 w-4" />
          </Button>
        </div>

        {/* Canvas */}
        <div className="flex-1 overflow-hidden border rounded-md bg-white relative">
          <canvas
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            className="w-full h-full cursor-crosshair"
            style={{ maxHeight: "500px" }}
          />

          {/* Text input overlay */}
          {textPosition && (
            <div
              className="absolute"
              style={{ left: `${(textPosition.x / 900) * 100}%`, top: `${(textPosition.y / 600) * 100}%` }}
            >
              <Input
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleTextSubmit()}
                onBlur={handleTextSubmit}
                placeholder="Type text..."
                className="h-7 text-xs w-40"
                autoFocus
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Insert Drawing
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

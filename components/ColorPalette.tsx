"use client"

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Palette } from "lucide-react"
import type React from "react"

interface ColorOption {
  value: string
  label: string
  className: string
}

const colorOptions: ColorOption[] = [
  { value: "#eab308", label: "Yellow", className: "bg-yellow-500" },
  { value: "#ec4899", label: "Pink", className: "bg-pink-500" },
  { value: "#3b82f6", label: "Blue", className: "bg-blue-500" },
  { value: "#22c55e", label: "Green", className: "bg-green-500" },
  { value: "#8b5cf6", label: "Purple", className: "bg-purple-500" },
  { value: "#f97316", label: "Orange", className: "bg-orange-500" },
  { value: "#ef4444", label: "Red", className: "bg-red-500" },
  { value: "#6b7280", label: "Gray", className: "bg-gray-500" },
  { value: "#ffffff", label: "White", className: "bg-white border border-gray-300" },
  { value: "#06b6d4", label: "Cyan", className: "bg-cyan-500" },
  { value: "#6366f1", label: "Indigo", className: "bg-indigo-500" },
  { value: "#65a30d", label: "Lime", className: "bg-lime-600" },
]

interface ColorPaletteProps {
  readonly currentColor?: string
  readonly onColorChange: (color: string) => void
  readonly size?: "sm" | "md"
  readonly disabled?: boolean
}

export const ColorPalette: React.FC<ColorPaletteProps> = ({
  currentColor = "#ffffff",
  onColorChange,
  size = "sm",
  disabled = false,
}) => {
  const buttonSize = size === "sm" ? "h-6 w-6" : "h-8 w-8"
  const iconSize = size === "sm" ? "h-3 w-3" : "h-4 w-4"

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled}
          className={`${buttonSize} p-0`}
          title="Change border color"
        >
          <Palette className={`${iconSize} text-black`} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="z-[9999] bg-white border shadow-lg p-2">
        <div className="grid grid-cols-4 gap-2">
          {colorOptions.map((color) => (
            <DropdownMenuItem
              key={color.value}
              onClick={() => onColorChange(color.value)}
              className="p-0 h-8 w-8 cursor-pointer hover:bg-gray-100 rounded"
              title={color.label}
            >
              <div
                className={`w-6 h-6 rounded ${color.className} ${
                  currentColor === color.value ? "ring-2 ring-gray-600" : ""
                }`}
              />
            </DropdownMenuItem>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

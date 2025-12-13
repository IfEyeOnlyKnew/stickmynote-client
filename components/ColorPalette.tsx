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
  { value: "#fbbf24", label: "Yellow", className: "bg-yellow-300" },
  { value: "#f472b6", label: "Pink", className: "bg-pink-400" },
  { value: "#60a5fa", label: "Blue", className: "bg-blue-400" },
  { value: "#34d399", label: "Green", className: "bg-green-400" },
  { value: "#a78bfa", label: "Purple", className: "bg-purple-400" },
  { value: "#fb923c", label: "Orange", className: "bg-orange-400" },
  { value: "#f87171", label: "Red", className: "bg-red-400" },
  { value: "#9ca3af", label: "Gray", className: "bg-gray-400" },
  { value: "#ffffff", label: "White", className: "bg-white border border-gray-300" },
  { value: "#22d3ee", label: "Cyan", className: "bg-cyan-400" },
  { value: "#818cf8", label: "Indigo", className: "bg-indigo-400" },
  { value: "#84cc16", label: "Lime", className: "bg-lime-400" },
]

interface ColorPaletteProps {
  currentColor?: string
  onColorChange: (color: string) => void
  size?: "sm" | "md"
  disabled?: boolean
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
          <Palette className={iconSize} />
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

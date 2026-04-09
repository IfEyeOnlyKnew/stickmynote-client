"use client"

import { ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

interface Tone {
  value: string
  label: string
}

interface ExportDropdownProps {
  tones: Tone[]
  isExporting: boolean
  onExportAll: () => void
}

export function ExportDropdown({ tones, isExporting, onExportAll }: ExportDropdownProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={isExporting} className="text-xs h-7 bg-transparent">
          {isExporting ? (
            <>
              <div className="h-3 w-3 mr-1 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
              Exporting...
            </>
          ) : (
            <>
              Export
              <ChevronDown className="h-3 w-3 ml-1" />
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-white border shadow-lg">
        {tones.map((tone) => (
          <DropdownMenuItem
            key={tone.value}
            onClick={() => onExportAll()}
            className="text-xs cursor-pointer hover:bg-gray-100 px-3 py-2"
          >
            Export as {tone.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

interface SummaryDropdownProps {
  tones: Tone[]
  isGeneratingSummary: boolean
  onGenerateSummary: (tone: string) => void
  onGenerateSummaryDocx?: (tone: string) => void
}

export function SummaryDropdown({ tones, isGeneratingSummary, onGenerateSummary, onGenerateSummaryDocx }: SummaryDropdownProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={isGeneratingSummary}
          className="text-xs h-7 bg-transparent"
        >
          {isGeneratingSummary ? (
            <>
              <div className="h-3 w-3 mr-1 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
              Generating...
            </>
          ) : (
            <>
              Summary
              <ChevronDown className="h-3 w-3 ml-1" />
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-white border shadow-lg">
        {tones.map((tone) => (
          <DropdownMenuItem
            key={`text-${tone.value}`}
            onClick={() => onGenerateSummary(tone.value)}
            className="text-xs cursor-pointer hover:bg-gray-100 px-3 py-2"
          >
            {tone.label}
          </DropdownMenuItem>
        ))}
        {onGenerateSummaryDocx && (
          <>
            <div className="border-t border-gray-200 my-1"></div>
            {tones.map((tone) => (
              <DropdownMenuItem
                key={`docx-${tone.value}`}
                onClick={() => onGenerateSummaryDocx(tone.value)}
                className="text-xs cursor-pointer hover:bg-gray-100 px-3 py-2"
              >
                {tone.label} (Word Doc)
              </DropdownMenuItem>
            ))}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

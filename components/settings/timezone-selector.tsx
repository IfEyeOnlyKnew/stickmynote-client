"use client"

import { useState, useEffect } from "react"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Globe, RefreshCw } from "lucide-react"
import {
  TIMEZONE_GROUPS,
  detectBrowserTimezone,
  getClosestTimezone,
  getTimezoneLabel,
} from "@/lib/constants/timezones"

interface TimezoneSelectorProps {
  value: string
  onChange: (value: string) => void
  showAutoDetect?: boolean
  disabled?: boolean
  className?: string
}

export function TimezoneSelector({
  value,
  onChange,
  showAutoDetect = true,
  disabled = false,
  className,
}: Readonly<TimezoneSelectorProps>) {
  const [detectedTimezone, setDetectedTimezone] = useState<string | null>(null)

  // Detect browser timezone on mount
  useEffect(() => {
    const browserTz = detectBrowserTimezone()
    const closestTz = getClosestTimezone(browserTz)
    setDetectedTimezone(closestTz)
  }, [])

  // Handle auto-detect button click
  const handleAutoDetect = () => {
    if (detectedTimezone) {
      onChange(detectedTimezone)
    }
  }

  // Group labels for display
  const regionOrder = [
    "Americas",
    "Europe",
    "Middle East",
    "Africa",
    "Asia Pacific",
    "Australia & Oceania",
  ]

  return (
    <div className={className}>
      <div className="flex items-center gap-2">
        <Select value={value} onValueChange={onChange} disabled={disabled}>
          <SelectTrigger className="w-full">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <SelectValue placeholder="Select timezone">
                {value ? getTimezoneLabel(value) : "Select timezone"}
              </SelectValue>
            </div>
          </SelectTrigger>
          <SelectContent className="max-h-[300px]">
            {regionOrder.map((region) => {
              const timezones = TIMEZONE_GROUPS[region]
              if (!timezones || timezones.length === 0) return null

              return (
                <SelectGroup key={region}>
                  <SelectLabel className="text-xs font-semibold text-muted-foreground px-2 py-1.5 bg-muted/50">
                    {region}
                  </SelectLabel>
                  {timezones.map((tz) => (
                    <SelectItem key={tz.value} value={tz.value}>
                      <span className="text-muted-foreground mr-2">{tz.offset}</span>
                      {tz.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              )
            })}
          </SelectContent>
        </Select>

        {showAutoDetect && detectedTimezone && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={handleAutoDetect}
            disabled={disabled || value === detectedTimezone}
            title="Auto-detect from browser"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        )}
      </div>

      {showAutoDetect && detectedTimezone && detectedTimezone !== value && (
        <p className="text-xs text-muted-foreground mt-1">
          Detected: {getTimezoneLabel(detectedTimezone)}
        </p>
      )}
    </div>
  )
}

// Simpler inline version for compact displays
export function TimezoneDisplay({ timezone }: Readonly<{ timezone: string }>) {
  return (
    <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
      <Globe className="h-3 w-3" />
      {getTimezoneLabel(timezone)}
    </span>
  )
}

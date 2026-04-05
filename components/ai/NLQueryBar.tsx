"use client"

import type React from "react"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Sparkles, X } from "lucide-react"
import { toast } from "@/hooks/use-toast"

interface NLQueryBarProps {
  onFiltersChange: (filters: any) => void
}

export function NLQueryBar({ onFiltersChange }: Readonly<NLQueryBarProps>) {
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(false)
  const [active, setActive] = useState(false)

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!query.trim()) return

    try {
      setLoading(true)
      const response = await fetch("/api/ai/query-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      })

      if (!response.ok) throw new Error("Failed to process query")

      const data = await response.json()
      onFiltersChange(data.filters)
      setActive(true)
      toast({
        title: "Filters Applied",
        description: "AI has filtered your tasks based on your query.",
      })
    } catch (error) {
      console.error("Error processing query:", error)
      toast({
        title: "Error",
        description: "Failed to process your request.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const clearSearch = () => {
    setQuery("")
    setActive(false)
    onFiltersChange({})
  }

  return (
    <form onSubmit={handleSearch} className="relative flex items-center w-full max-w-md">
      <div className="relative w-full">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
          {loading ? (
            <Sparkles className="h-4 w-4 animate-pulse text-purple-500" />
          ) : (
            <Sparkles className="h-4 w-4 text-purple-500" />
          )}
        </div>
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask AI: 'Show me high priority tasks due tomorrow'..."
          className="pl-9 pr-20 bg-muted/30 border-muted-foreground/20 focus-visible:ring-purple-500"
        />
        <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {active && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={clearSearch}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
          <Button
            type="submit"
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs font-medium text-purple-600 hover:text-purple-700 hover:bg-purple-50"
            disabled={loading || !query.trim()}
          >
            Ask
          </Button>
        </div>
      </div>
    </form>
  )
}

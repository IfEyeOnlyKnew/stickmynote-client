"use client"

import type React from "react"
import { ChevronRight, ChevronDown, Search, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import Link from "next/link"
import { useState, useEffect, useCallback } from "react"

interface BreadcrumbItem {
  label: string
  href?: string
  onClick?: () => void
  current?: boolean
  showPadDropdown?: boolean
}

interface BreadcrumbNavProps {
  items: BreadcrumbItem[]
}

interface AccessiblePad {
  id: string
  name: string
  isOwner: boolean
  multiPakName: string | null
  href: string
}

export function BreadcrumbNav({ items }: Readonly<BreadcrumbNavProps>) {
  const [pads, setPads] = useState<AccessiblePad[]>([])
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState("")
  const [dropdownOpen, setDropdownOpen] = useState(false)

  const fetchPads = useCallback(
    async (pageNum: number, searchTerm: string, reset = false) => {
      if (loading) return

      setLoading(true)
      try {
        const response = await fetch(
          `/api/user/accessible-pads?page=${pageNum}&limit=10&search=${encodeURIComponent(searchTerm)}`,
        )
        const data = await response.json()

        if (response.ok) {
          setPads((prev) => (reset ? data.pads : [...prev, ...data.pads]))
          setHasMore(data.hasMore)
        }
      } catch (error) {
        console.error("Error fetching pads:", error)
      } finally {
        setLoading(false)
      }
    },
    [loading],
  )

  useEffect(() => {
    if (dropdownOpen && pads.length === 0) {
      fetchPads(0, search, true)
    }
  }, [dropdownOpen, fetchPads, pads.length, search])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (dropdownOpen) {
        setPage(0)
        fetchPads(0, search, true)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [search, dropdownOpen, fetchPads])

  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const { scrollTop, scrollHeight, clientHeight } = e.currentTarget
      if (scrollHeight - scrollTop <= clientHeight * 1.5 && hasMore && !loading) {
        const nextPage = page + 1
        setPage(nextPage)
        fetchPads(nextPage, search)
      }
    },
    [hasMore, loading, page, search, fetchPads],
  )

  return (
    <nav className="flex items-center space-x-1 text-sm text-gray-600 mb-6">
      {items.map((item, index) => (
        <div key={item.label} className="flex items-center">
          {index > 0 && <ChevronRight className="h-4 w-4 mx-1 text-gray-400" />}

          {item.showPadDropdown ? (
            <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto p-1 font-medium text-gray-600 hover:text-gray-900 flex items-center gap-1"
                >
                  {item.label}
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-80 p-0" align="start">
                <div className="p-3 border-b">
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search pads..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                </div>
                <ScrollArea className="h-64" onScrollCapture={handleScroll}>
                  <div className="p-2">
                    {pads.map((pad) => (
                      <Link key={pad.id} href={pad.href}>
                        <div className="flex items-center justify-between p-2 rounded hover:bg-gray-50 cursor-pointer">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate">{pad.name}</div>
                            {pad.multiPakName && (
                              <div className="text-xs text-gray-500 truncate">in {pad.multiPakName}</div>
                            )}
                          </div>
                          {pad.isOwner && (
                            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">Owner</span>
                          )}
                        </div>
                      </Link>
                    ))}
                    {loading && (
                      <div className="flex items-center justify-center p-4">
                        <Loader2 className="h-4 w-4 animate-spin" />
                      </div>
                    )}
                    {!hasMore && pads.length > 0 && (
                      <div className="text-center text-xs text-gray-500 p-2">No more pads</div>
                    )}
                    {pads.length === 0 && !loading && (
                      <div className="text-center text-sm text-gray-500 p-4">No pads found</div>
                    )}
                  </div>
                </ScrollArea>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
          {!item.showPadDropdown && (item.href || item.onClick) && !item.current && (
            item.href ? (
              <Link href={item.href}>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto p-1 font-medium text-gray-600 hover:text-blue-600 hover:bg-blue-50"
                >
                  {item.label}
                </Button>
              </Link>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="h-auto p-1 font-medium text-gray-600 hover:text-blue-600 hover:bg-blue-50"
                onClick={item.onClick}
              >
                {item.label}
              </Button>
            )
          )}
          {!item.showPadDropdown && !((item.href || item.onClick) && !item.current) && (
            <span className={`font-semibold ${item.current ? "text-purple-600" : "text-gray-900"}`}>{item.label}</span>
          )}
        </div>
      ))}
    </nav>
  )
}

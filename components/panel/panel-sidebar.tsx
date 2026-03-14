"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Globe, ShieldCheck, MessageCircle, ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

const STORAGE_KEY = "panel-sidebar-collapsed"

interface NavItem {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  exact?: boolean
}

export function PanelSidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [isConcurAdmin, setIsConcurAdmin] = useState(false)
  const [isConcurMember, setIsConcurMember] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === "true") setCollapsed(true)
  }, [])

  // Fetch Concur status to determine which nav items to show
  useEffect(() => {
    const fetchConcurStatus = async () => {
      try {
        const res = await fetch("/api/concur/groups")
        if (res.ok) {
          const data = await res.json()
          setIsConcurAdmin(data.isConcurAdmin || false)
          setIsConcurMember((data.groups?.length || 0) > 0)
        }
      } catch {
        // Silent fail
      }
    }
    fetchConcurStatus()
  }, [])

  const toggleCollapsed = () => {
    const next = !collapsed
    setCollapsed(next)
    localStorage.setItem(STORAGE_KEY, String(next))
  }

  // Build nav items dynamically based on user's Concur status
  const navItems: NavItem[] = [
    { href: "/panel", label: "Shared Sticks", icon: Globe, exact: true },
  ]

  if (isConcurAdmin) {
    navItems.push({ href: "/concur", label: "Concur Admin", icon: ShieldCheck, exact: true })
  }

  if (isConcurAdmin || isConcurMember) {
    navItems.push({ href: "/concur", label: "Concur Sticks", icon: MessageCircle })
  }

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          "border-r bg-muted/30 flex flex-col h-full shrink-0 transition-all duration-200",
          collapsed ? "w-14" : "w-60"
        )}
      >
        {/* Header */}
        <div className="p-2 border-b flex items-center justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleCollapsed}
            className="h-8 w-8 p-0"
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-2 space-y-1">
          {navItems.map((item) => {
            const isActive = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href)

            const linkContent = (
              <Link key={item.label} href={item.href}>
                <div
                  className={cn(
                    "flex items-center gap-3 rounded-md text-sm font-medium transition-colors",
                    collapsed ? "justify-center px-2 py-2" : "px-3 py-2",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {!collapsed && <span>{item.label}</span>}
                </div>
              </Link>
            )

            if (collapsed) {
              return (
                <Tooltip key={item.label}>
                  <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                  <TooltipContent side="right">
                    <p>{item.label}</p>
                  </TooltipContent>
                </Tooltip>
              )
            }

            return <div key={item.label}>{linkContent}</div>
          })}
        </nav>
      </aside>
    </TooltipProvider>
  )
}

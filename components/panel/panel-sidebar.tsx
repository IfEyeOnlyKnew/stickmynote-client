"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Globe, ShieldCheck, MessageCircle, StickyNote, ChevronLeft, ChevronRight, Menu, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useIsMobile } from "@/hooks/use-mobile"

const STORAGE_KEY = "panel-sidebar-collapsed"

interface NavItem {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  exact?: boolean
}

export function PanelSidebar() {
  const pathname = usePathname()
  const isMobile = useIsMobile()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [isConcurAdmin, setIsConcurAdmin] = useState(false)
  const [isConcurMember, setIsConcurMember] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === "true") setCollapsed(true)
  }, [])

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

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
    { href: "/personal", label: "Personal Sticks", icon: StickyNote, exact: true },
    { href: "/panel", label: "Comm Sticks", icon: Globe, exact: true },
  ]

  if (isConcurAdmin) {
    navItems.push({ href: "/concur", label: "Concur Admin", icon: ShieldCheck, exact: true })
  }

  if (isConcurAdmin || isConcurMember) {
    navItems.push({ href: "/concur/sticks", label: "Concur Sticks", icon: MessageCircle })
  }

  // Mobile: hamburger button + slide-over overlay
  if (isMobile) {
    return (
      <>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setMobileOpen(true)}
          className="fixed top-3 left-3 z-[60] h-9 w-9 p-0 bg-white shadow-md border"
        >
          <Menu className="h-5 w-5" />
        </Button>

        {mobileOpen && (
          <div className="fixed inset-0 z-[9999]">
            {/* Backdrop */}
            <button
              type="button"
              className="absolute inset-0 bg-black/40 border-none cursor-default"
              aria-label="Close sidebar"
              onClick={() => setMobileOpen(false)}
            />
            {/* Slide-over panel */}
            <aside className="absolute top-0 left-0 h-full w-64 bg-white shadow-xl flex flex-col animate-in slide-in-from-left duration-200">
              <div className="p-3 border-b flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-700">Navigation</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setMobileOpen(false)}
                  className="h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <nav className="flex-1 p-2 space-y-1">
                {navItems.map((item) => {
                  const isActive = item.exact
                    ? pathname === item.href
                    : pathname.startsWith(item.href)
                  return (
                    <Link key={item.label} href={item.href} onClick={() => setMobileOpen(false)}>
                      <div
                        className={cn(
                          "flex items-center gap-3 rounded-md text-sm font-medium transition-colors px-3 py-2.5",
                          isActive
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                      >
                        <item.icon className="h-4 w-4 shrink-0" />
                        <span>{item.label}</span>
                      </div>
                    </Link>
                  )
                })}
              </nav>
            </aside>
          </div>
        )}
      </>
    )
  }

  // Desktop: normal sidebar
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

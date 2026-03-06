"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  Clock,
  FileText,
  DollarSign,
  BarChart3,
  Target,
  LayoutTemplate,
  ClipboardList,
  ChevronLeft,
  ListChecks,
  Settings,
} from "lucide-react"
import { Button } from "@/components/ui/button"

const navItems = [
  { href: "/pm", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/pm/timesheets", label: "Timesheets", icon: Clock },
  { href: "/pm/invoices", label: "Invoices", icon: FileText },
  { href: "/pm/budget", label: "Budget", icon: DollarSign },
  { href: "/pm/portfolio", label: "Portfolio", icon: BarChart3 },
  { href: "/pm/goals", label: "Goals & OKRs", icon: Target },
  { href: "/pm/templates", label: "Templates", icon: LayoutTemplate },
  { href: "/pm/forms", label: "Forms & Requests", icon: ClipboardList },
]

export function PMSidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-60 border-r bg-muted/30 flex flex-col h-full shrink-0">
      <div className="p-4 border-b">
        <Link href="/calsticks">
          <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground w-full justify-start">
            <ChevronLeft className="h-4 w-4" />
            <ListChecks className="h-4 w-4" />
            <span>CalSticks</span>
          </Button>
        </Link>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => {
          const isActive = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href)
          return (
            <Link key={item.href} href={item.href}>
              <div
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
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
      <div className="p-3 border-t">
        <Link href="/settings/organization">
          <div className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
            <Settings className="h-4 w-4 shrink-0" />
            <span>Settings</span>
          </div>
        </Link>
      </div>
    </aside>
  )
}

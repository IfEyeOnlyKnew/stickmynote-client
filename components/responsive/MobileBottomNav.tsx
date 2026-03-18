"use client"

import { usePathname } from "next/navigation"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { Home, StickyNote, MessageSquare, FolderKanban, User, BookOpen } from "lucide-react"
import { useIsMobile } from "@/hooks/use-mobile"

interface NavItem {
  href: string
  icon: React.ElementType
  label: string
  /** Match path prefix for active state */
  matchPrefix?: string
}

const navItems: NavItem[] = [
  { href: "/inference", icon: Home, label: "Home", matchPrefix: "/inference" },
  { href: "/inference/my-sticks", icon: StickyNote, label: "Notes", matchPrefix: "/inference/my-sticks" },
  { href: "/channels", icon: MessageSquare, label: "Chat", matchPrefix: "/channels" },
  { href: "/noted", icon: BookOpen, label: "Noted", matchPrefix: "/noted" },
  { href: "/pm", icon: FolderKanban, label: "Projects", matchPrefix: "/pm" },
  { href: "/profile", icon: User, label: "Profile", matchPrefix: "/profile" },
]

export function MobileBottomNav() {
  const pathname = usePathname()
  const isMobile = useIsMobile()

  if (!isMobile) return null

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur-sm"
      style={{ paddingBottom: "var(--safe-area-bottom, 0px)" }}
    >
      <div className="flex items-center justify-around">
        {navItems.map((item) => {
          const isActive = item.matchPrefix
            ? pathname === item.href || (pathname.startsWith(item.matchPrefix) && item.href !== "/inference")
            : pathname === item.href

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-0.5 py-2 px-3 text-xs transition-colors min-w-[64px]",
                isActive ? "text-primary" : "text-muted-foreground",
              )}
            >
              <item.icon className={cn("h-5 w-5", isActive && "text-primary")} />
              <span className="truncate">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

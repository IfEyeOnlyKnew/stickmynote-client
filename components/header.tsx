"use client"

import { StickyNote, Activity } from 'lucide-react'
import Link from "next/link"
import { UserMenu } from "./user-menu"
import { NotificationBell } from "./notifications/notification-bell"
import { useUser } from "@/contexts/user-context"

export function Header() {
  const { user } = useUser()

  return (
    <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Link href="/" className="flex items-center space-x-2">
            <StickyNote className="h-8 w-8 text-blue-600" />
            <span className="text-2xl font-bold text-gray-900">Stick My Note</span>
          </Link>
        </div>
        <nav className="hidden md:flex items-center space-x-6">
          {user && (
            <>
              <Link href="/personal" className="text-gray-600 hover:text-gray-900">
                Personal
              </Link>
              <Link href="/mypads" className="text-gray-600 hover:text-gray-900">
                Pads
              </Link>
              <Link href="/search" className="text-gray-600 hover:text-gray-900">
                Search
              </Link>
              <Link href="/activity" className="text-gray-600 hover:text-gray-900 flex items-center gap-1">
                <Activity className="h-4 w-4" />
                Activity
              </Link>
            </>
          )}
        </nav>
        <div className="flex items-center space-x-4">
          {user && <NotificationBell />}
          <UserMenu />
        </div>
      </div>
    </header>
  )
}

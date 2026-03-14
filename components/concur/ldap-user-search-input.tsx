"use client"

import React, { useState, useEffect, useRef } from "react"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Loader2, Search, UserPlus } from "lucide-react"

interface SearchedUser {
  id: string | null
  username: string | null
  email: string
  full_name: string | null
  source?: "ldap" | "database"
}

interface LdapUserSearchInputProps {
  label?: string
  placeholder?: string
  value: string
  onSelect: (user: SearchedUser) => void
  onChange?: (value: string) => void
  excludeEmails?: string[]
  disabled?: boolean
}

/**
 * LDAP-powered user search input with dropdown results.
 * Searches Active Directory and local database as user types.
 * When a user is selected, their email is set and the dropdown closes.
 */
export function LdapUserSearchInput({
  label,
  placeholder = "Search by name or email...",
  value,
  onSelect,
  onChange,
  excludeEmails = [],
  disabled = false,
}: LdapUserSearchInputProps) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchedUser[]>([])
  const [searching, setSearching] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const excludeRef = useRef<Set<string>>(new Set())

  // Keep exclude set in sync
  useEffect(() => {
    excludeRef.current = new Set(excludeEmails.map((e) => e.toLowerCase()))
  }, [excludeEmails])

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Debounced LDAP search
  useEffect(() => {
    if (!query.trim() || query.trim().length < 2) {
      setResults([])
      setShowDropdown(false)
      return
    }

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)

    searchTimeoutRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(`/api/user-search?query=${encodeURIComponent(query)}`)
        if (res.ok) {
          const users: SearchedUser[] = await res.json()
          const filtered = users.filter(
            (u) => u.email && !excludeRef.current.has(u.email.toLowerCase())
          )
          setResults(filtered)
          setShowDropdown(true)
        }
      } catch {
        // Silent fail
      } finally {
        setSearching(false)
      }
    }, 300)

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    }
  }, [query])

  const handleInputChange = (val: string) => {
    setQuery(val)
    onChange?.(val)
  }

  const handleSelect = (user: SearchedUser) => {
    setQuery("")
    setResults([])
    setShowDropdown(false)
    onSelect(user)
  }

  const getInitials = (user: SearchedUser) => {
    const name = user.full_name || user.username || user.email
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  // Show the selected email value or the search query
  const displayValue = value && !query ? value : query

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          value={displayValue}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => {
            if (value) {
              // User is clicking back into a filled field — let them search again
              setQuery(value)
              onChange?.("")
            }
          }}
          placeholder={placeholder}
          className="pl-10"
          disabled={disabled}
        />
        {searching && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-gray-400" />
        )}
      </div>

      {showDropdown && results.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg">
          <ScrollArea className="max-h-48">
            <div className="p-1 space-y-0.5">
              {results.map((user) => (
                <button
                  key={user.email}
                  type="button"
                  onClick={() => handleSelect(user)}
                  className="w-full flex items-center gap-3 p-2 hover:bg-gray-100 rounded-md transition-colors text-left"
                >
                  <Avatar className="w-7 h-7">
                    <AvatarFallback className="text-xs bg-indigo-100 text-indigo-700">
                      {getInitials(user)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">
                      {user.full_name || user.username || user.email}
                    </div>
                    <div className="text-xs text-gray-500 truncate">{user.email}</div>
                  </div>
                  <UserPlus className="w-4 h-4 text-gray-400 shrink-0" />
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      {showDropdown && query.trim().length >= 2 && !searching && results.length === 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg p-3 text-center text-sm text-gray-500">
          No users found
        </div>
      )}
    </div>
  )
}

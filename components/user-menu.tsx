"use client"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useUser } from "@/contexts/user-context"
import { useOrganization } from "@/contexts/organization-context"
import { useRouter } from "next/navigation"
import { User, Settings, LogOut, BarChart3, FolderKanban, Users, Building, StickyNote } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

interface UserMenuProps {
  hideSettings?: boolean
  hideHowToSearch?: boolean
  showAbout?: boolean
  showClearAllNotes?: boolean
  showDeleteAccount?: boolean
  onClearAllNotes?: () => void
  onDeleteAccount?: () => void
}

export function UserMenu({
  hideSettings = false,
  hideHowToSearch = false,
  showAbout = false,
  showClearAllNotes = false,
  showDeleteAccount = false,
  onClearAllNotes,
  onDeleteAccount,
}: UserMenuProps = {}) {
  const { user, profile } = useUser()
  const { currentOrg, canManage, currentOrgRole } = useOrganization()
  const router = useRouter()

  const isAdmin = user?.email === "chrisdoran63@outlook.com"
  const isOwner = currentOrgRole === "owner"
  const isFirstLogin = (profile?.login_count ?? 0) <= 1
  // Show org settings if: owner, can manage, first login, OR no organization exists yet
  const showOrgSettings = isOwner || canManage || isFirstLogin || !currentOrg
  const orgLogoUrl = currentOrg?.settings?.branding?.page_logo_url

  const getInitials = () => {
    if (profile?.full_name) {
      const names = profile.full_name.split(" ")
      return names.length > 1 ? `${names[0][0]}${names[1][0]}`.toUpperCase() : names[0].substring(0, 2).toUpperCase()
    }
    if (profile?.username) {
      return profile.username.substring(0, 2).toUpperCase()
    }
    if (user?.email) {
      return user.email.substring(0, 2).toUpperCase()
    }
    return "U"
  }

  const getOrgInitials = () => {
    if (currentOrg?.name) {
      return currentOrg.name
        .split(" ")
        .map((word) => word[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    }
    return "O"
  }

  const getDisplayName = () => {
    return profile?.full_name || profile?.username || user?.email || "User"
  }

  const handleLogout = async () => {
    try {
      // Use local auth signout API
      await fetch('/api/auth/signout', { method: 'POST', credentials: 'include' })

      setTimeout(() => {
        window.location.href = "/"
      }, 500)
    } catch (error) {
      console.error("Logout error:", error)
      window.location.href = "/"
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-8 w-8 rounded-full">
          <Avatar className="h-8 w-8">
            {orgLogoUrl ? (
              <AvatarImage src={orgLogoUrl || "/placeholder.svg"} alt={currentOrg?.name || "Organization"} />
            ) : profile?.avatar_url ? (
              <AvatarImage src={profile.avatar_url || "/placeholder.svg"} alt={getDisplayName()} />
            ) : null}
            <AvatarFallback>{orgLogoUrl ? getOrgInitials() : getInitials()}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{getDisplayName()}</p>
            <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
            {currentOrg && (
              <p className="text-xs leading-none text-primary font-medium mt-1">{currentOrg.name}</p>
            )}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push("/dashboard")}>
          <BarChart3 className="mr-2 h-4 w-4" />
          <span>Dashboard</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push("/personal")}>
          <StickyNote className="mr-2 h-4 w-4" />
          <span>Personal Hub</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push("/paks")}>
          <FolderKanban className="mr-2 h-4 w-4" />
          <span>Paks Hub</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push("/social")}>
          <Users className="mr-2 h-4 w-4" />
          <span>Social Hub</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push("/profile")}>
          <User className="mr-2 h-4 w-4" />
          <span>Profile</span>
        </DropdownMenuItem>
        {showOrgSettings && (
          <DropdownMenuItem onClick={() => router.push("/settings/organization")}>
            <Building className="mr-2 h-4 w-4" />
            <span>Organization Settings</span>
          </DropdownMenuItem>
        )}
        {isAdmin && (
          <DropdownMenuItem onClick={() => router.push("/social/admin")}>
            <Settings className="mr-2 h-4 w-4" />
            <span>Social Hub Admin</span>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        {showClearAllNotes && onClearAllNotes && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onClearAllNotes} className="text-red-600 focus:text-red-600">
              <LogOut className="mr-2 h-4 w-4" />
              <span>Clear All Notes</span>
            </DropdownMenuItem>
          </>
        )}
        {showDeleteAccount && onDeleteAccount && (
          <DropdownMenuItem onClick={onDeleteAccount} className="text-red-700 focus:text-red-700 font-medium">
            <User className="mr-2 h-4 w-4" />
            <span>Delete Account</span>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout} className="text-red-600 focus:text-red-600">
          <LogOut className="mr-2 h-4 w-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

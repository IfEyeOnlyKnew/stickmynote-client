"use client"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal,
} from "@/components/ui/dropdown-menu"
import { useUser } from "@/contexts/user-context"
import { useOrganization } from "@/contexts/organization-context"
import { useRouter } from "next/navigation"
import { User, Settings, LogOut, BarChart3, FolderKanban, Users, Building, StickyNote, MessageSquare, Video, Circle, ListChecks } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useUserStatus } from "@/hooks/useUserStatus"
import { UserStatusIndicator, StatusIcon } from "@/components/user-status"
import { STATUS_LABELS } from "@/types/user-status"
import type { UserStatusType } from "@/types/user-status"
import { getTimezoneAbbreviation } from "@/lib/constants/timezones"

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
  const { effective, setOnline, setAway, setBusy, setDND, updating } = useUserStatus()

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

  const currentStatus = effective?.status || "online"

  const handleStatusChange = async (status: UserStatusType) => {
    switch (status) {
      case "online":
        await setOnline()
        break
      case "away":
        await setAway()
        break
      case "busy":
        await setBusy()
        break
      case "dnd":
        await setDND()
        break
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
          {/* Status indicator dot */}
          <UserStatusIndicator
            status={currentStatus}
            size="xs"
            showTooltip={false}
            className="absolute bottom-0 right-0 border-2 border-background"
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{getDisplayName()}</p>
            <div className="flex items-center gap-2">
              <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
              {(profile as any)?.timezone && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">
                  {getTimezoneAbbreviation((profile as any).timezone)}
                </span>
              )}
            </div>
            {currentOrg && (
              <p className="text-xs leading-none text-primary font-medium mt-1">{currentOrg.name}</p>
            )}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* Status Selector */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="gap-2" disabled={updating}>
            <UserStatusIndicator status={currentStatus} size="xs" showTooltip={false} />
            <span>{STATUS_LABELS[currentStatus]}</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent>
              <DropdownMenuItem onClick={() => handleStatusChange("online")} className="gap-2">
                <StatusIcon status="online" className="h-4 w-4" />
                <span>Online</span>
                {currentStatus === "online" && <Circle className="h-2 w-2 fill-primary text-primary ml-auto" />}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleStatusChange("away")} className="gap-2">
                <StatusIcon status="away" className="h-4 w-4" />
                <span>Away</span>
                {currentStatus === "away" && <Circle className="h-2 w-2 fill-primary text-primary ml-auto" />}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleStatusChange("busy")} className="gap-2">
                <StatusIcon status="busy" className="h-4 w-4" />
                <span>Busy</span>
                {currentStatus === "busy" && <Circle className="h-2 w-2 fill-primary text-primary ml-auto" />}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleStatusChange("dnd")} className="gap-2">
                <StatusIcon status="dnd" className="h-4 w-4" />
                <span>Do Not Disturb</span>
                {currentStatus === "dnd" && <Circle className="h-2 w-2 fill-primary text-primary ml-auto" />}
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>

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
          <span>Alliance Hub</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push("/inference")}>
          <Users className="mr-2 h-4 w-4" />
          <span>Inference Hub</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push("/chats")}>
          <MessageSquare className="mr-2 h-4 w-4" />
          <span>Chats Hub</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push("/video")}>
          <Video className="mr-2 h-4 w-4" />
          <span>Video Hub</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push("/calsticks")}>
          <ListChecks className="mr-2 h-4 w-4" />
          <span>CalSticks</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push("/pm")}>
          <BarChart3 className="mr-2 h-4 w-4" />
          <span>PM Hub</span>
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
          <DropdownMenuItem onClick={() => router.push("/inference/admin")}>
            <Settings className="mr-2 h-4 w-4" />
            <span>Inference Hub Admin</span>
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

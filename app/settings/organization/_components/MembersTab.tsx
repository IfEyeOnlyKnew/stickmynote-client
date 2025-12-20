"use client"

import type React from "react"
import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Users,
  Trash2,
  Mail,
  Shield,
  Loader2,
  Clock,
  Lock,
  Unlock,
  UserPlus,
  Upload,
  FileSpreadsheet,
  X,
  AlertCircle,
  Pencil,
  Check,
} from "lucide-react"

interface OrgMember {
  id: string
  org_id: string
  user_id: string
  role: string
  status?: string
  joined_at: string
  users?: {
    id: string
    email: string
    full_name?: string
    avatar_url?: string
  }
}

interface OrgInvite {
  id: string
  email: string
  role: string
  invited_at: string
  status: string
}

type MemberRole = "admin" | "member" | "viewer"

interface MembersTabProps {
  members: OrgMember[]
  loadingMembers: boolean
  pendingInvites: OrgInvite[]
  inviteEmail: string
  setInviteEmail: (email: string) => void
  inviteRole: MemberRole
  setInviteRole: (role: MemberRole) => void
  inviting: boolean
  handleInvite: () => void
  handleCancelInvite: (inviteId: string) => void
  handleRemoveMember: (memberId: string) => void
  handleUpdateRole: (memberId: string, newRole: string) => void
  handleTransferOwnership?: (newOwnerEmail: string) => Promise<boolean>
  canManage: boolean
  canAddMembers: boolean
  currentOrgRole: string | null
  user: { id: string } | null
  isPersonalOrg: boolean
  requirePreregistration: boolean
  savingPreregSetting: boolean
  handleTogglePreregistration: () => void
  csvFile: File | null
  setCsvFile: (file: File | null) => void
  csvFileName: string
  setCsvFileName: (name: string) => void
  importing: boolean
  handleCsvFileUpload: () => void
  getRoleIcon: (role: string) => React.ReactNode
  getRoleBadgeColor: (role: string) => string
}

export function MembersTab({
  members,
  loadingMembers,
  pendingInvites,
  inviteEmail,
  setInviteEmail,
  inviteRole,
  setInviteRole,
  inviting,
  handleInvite,
  handleCancelInvite,
  handleRemoveMember,
  handleUpdateRole,
  handleTransferOwnership,
  canManage,
  canAddMembers,
  currentOrgRole,
  user,
  isPersonalOrg,
  requirePreregistration,
  savingPreregSetting,
  handleTogglePreregistration,
  csvFile,
  setCsvFile,
  csvFileName,
  setCsvFileName,
  importing,
  handleCsvFileUpload,
  getRoleIcon,
  getRoleBadgeColor,
}: Readonly<MembersTabProps>) {
  return (
    <div className="space-y-6">
      {canManage && !isPersonalOrg && (
        <AccessSecurityCard
          requirePreregistration={requirePreregistration}
          savingPreregSetting={savingPreregSetting}
          handleTogglePreregistration={handleTogglePreregistration}
        />
      )}

      {canAddMembers && (
        <InviteMembersCard
          inviteEmail={inviteEmail}
          setInviteEmail={setInviteEmail}
          inviteRole={inviteRole}
          setInviteRole={setInviteRole}
          inviting={inviting}
          handleInvite={handleInvite}
          currentOrgRole={currentOrgRole}
          csvFile={csvFile}
          setCsvFile={setCsvFile}
          csvFileName={csvFileName}
          setCsvFileName={setCsvFileName}
          importing={importing}
          handleCsvFileUpload={handleCsvFileUpload}
        />
      )}

      {canManage && pendingInvites.length > 0 && (
        <PendingInvitesCard
          pendingInvites={pendingInvites}
          handleCancelInvite={handleCancelInvite}
        />
      )}

      <MembersListCard
        members={members}
        loadingMembers={loadingMembers}
        canManage={canManage}
        currentOrgRole={currentOrgRole}
        user={user}
        handleUpdateRole={handleUpdateRole}
        handleRemoveMember={handleRemoveMember}
        handleTransferOwnership={handleTransferOwnership}
        getRoleIcon={getRoleIcon}
        getRoleBadgeColor={getRoleBadgeColor}
      />
    </div>
  )
}

interface AccessSecurityCardProps {
  requirePreregistration: boolean
  savingPreregSetting: boolean
  handleTogglePreregistration: () => void
}

function AccessSecurityCard({
  requirePreregistration,
  savingPreregSetting,
  handleTogglePreregistration,
}: Readonly<AccessSecurityCardProps>) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Access Security
        </CardTitle>
        <CardDescription>Control how new users can join your organization</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="font-medium">Require Pre-registration</p>
            <p className="text-sm text-muted-foreground">
              {requirePreregistration
                ? "Only pre-registered emails can join your organization"
                : "Anyone with your domain email can automatically join"}
            </p>
          </div>
          <Button
            variant={requirePreregistration ? "default" : "outline"}
            onClick={handleTogglePreregistration}
            disabled={savingPreregSetting}
          >
            {savingPreregSetting && <Loader2 className="h-4 w-4 animate-spin" />}
            {!savingPreregSetting && requirePreregistration && (
              <>
                <Lock className="h-4 w-4 mr-2" />
                Enabled
              </>
            )}
            {!savingPreregSetting && !requirePreregistration && (
              <>
                <Unlock className="h-4 w-4 mr-2" />
                Disabled
              </>
            )}
          </Button>
        </div>
        {requirePreregistration && (
          <div className="mt-4 rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
            <AlertCircle className="h-4 w-4 inline mr-2" />
            Users must be pre-registered via CSV import before they can log in. No invitation emails are sent.
          </div>
        )}
      </CardContent>
    </Card>
  )
}

interface InviteMembersCardProps {
  inviteEmail: string
  setInviteEmail: (email: string) => void
  inviteRole: MemberRole
  setInviteRole: (role: MemberRole) => void
  inviting: boolean
  handleInvite: () => void
  currentOrgRole: string | null
  csvFile: File | null
  setCsvFile: (file: File | null) => void
  csvFileName: string
  setCsvFileName: (name: string) => void
  importing: boolean
  handleCsvFileUpload: () => void
}

function InviteMembersCard({
  inviteEmail,
  setInviteEmail,
  inviteRole,
  setInviteRole,
  inviting,
  handleInvite,
  currentOrgRole,
  csvFile,
  setCsvFile,
  csvFileName,
  setCsvFileName,
  importing,
  handleCsvFileUpload,
}: Readonly<InviteMembersCardProps>) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <UserPlus className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Invite New Members</CardTitle>
              <CardDescription>Send an invitation email to add new members</CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex gap-4">
          <div className="flex-1">
            <Input
              type="email"
              placeholder="colleague@company.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
            />
          </div>
          <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as typeof inviteRole)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="viewer">Viewer</SelectItem>
              <SelectItem value="member">Member</SelectItem>
              {currentOrgRole === "owner" && <SelectItem value="admin">Admin</SelectItem>}
            </SelectContent>
          </Select>
          <Button onClick={handleInvite} disabled={inviting || !inviteEmail.trim()}>
            {inviting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Mail className="h-4 w-4 mr-2" />}
            Invite
          </Button>
        </div>

        <div className="border-t pt-4 mt-4">
          <div className="flex items-center gap-2 mb-2">
            <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Import from CSV File</span>
          </div>
          <p className="text-sm text-muted-foreground mb-3">
            Upload a CSV file with email addresses and names. Format: email,name (one per line)
          </p>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label
                htmlFor="csv-upload"
                className="flex items-center justify-center gap-2 h-10 px-4 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors"
              >
                <Upload className="h-4 w-4" />
                {csvFileName || "Choose CSV file..."}
              </label>
              <input
                id="csv-upload"
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) {
                    setCsvFile(file)
                    setCsvFileName(file.name)
                  }
                }}
              />
            </div>
            <Button onClick={handleCsvFileUpload} disabled={importing || !csvFile}>
              {importing ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <FileSpreadsheet className="h-4 w-4 mr-2" />
              )}
              Import
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

interface PendingInvitesCardProps {
  pendingInvites: OrgInvite[]
  handleCancelInvite: (inviteId: string) => void
}

function PendingInvitesCard({ pendingInvites, handleCancelInvite }: Readonly<PendingInvitesCardProps>) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Pending Invitations ({pendingInvites.length})
        </CardTitle>
        <CardDescription>These users have been invited but haven&apos;t signed up yet.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {pendingInvites.map((invite) => (
            <div
              key={invite.id}
              className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg border border-yellow-200"
            >
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-yellow-200 text-yellow-700">
                    {invite.email.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium text-gray-900">{invite.email}</p>
                  <p className="text-sm text-gray-500">
                    Invited {new Date(invite.invited_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300">
                  {invite.role}
                </Badge>
                <Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-300">
                  Pending
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCancelInvite(invite.id)}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

interface MembersListCardProps {
  members: OrgMember[]
  loadingMembers: boolean
  canManage: boolean
  currentOrgRole: string | null
  user: { id: string } | null
  handleUpdateRole: (memberId: string, newRole: string) => void
  handleRemoveMember: (memberId: string) => void
  handleTransferOwnership?: (newOwnerEmail: string) => Promise<boolean>
  getRoleIcon: (role: string) => React.ReactNode
  getRoleBadgeColor: (role: string) => string
}

function MembersListCard({
  members,
  loadingMembers,
  canManage,
  currentOrgRole,
  user,
  handleUpdateRole,
  handleRemoveMember,
  handleTransferOwnership,
  getRoleIcon,
  getRoleBadgeColor,
}: Readonly<MembersListCardProps>) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Members ({members.length})
        </CardTitle>
        <CardDescription>People with access to this organization</CardDescription>
      </CardHeader>
      <CardContent>
        {loadingMembers && (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        )}
        {!loadingMembers && members.length === 0 && (
          <p className="text-center text-gray-500 py-8">No members found</p>
        )}
        {!loadingMembers && members.length > 0 && (
          <div className="space-y-3">
            {members.map((member) => (
              <MemberItem
                key={member.id}
                member={member}
                canManage={canManage}
                currentOrgRole={currentOrgRole}
                user={user}
                handleUpdateRole={handleUpdateRole}
                handleRemoveMember={handleRemoveMember}
                handleTransferOwnership={handleTransferOwnership}
                getRoleIcon={getRoleIcon}
                getRoleBadgeColor={getRoleBadgeColor}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

interface MemberItemProps {
  member: OrgMember
  canManage: boolean
  currentOrgRole: string | null
  user: { id: string } | null
  handleUpdateRole: (memberId: string, newRole: string) => void
  handleRemoveMember: (memberId: string) => void
  handleTransferOwnership?: (newOwnerEmail: string) => Promise<boolean>
  getRoleIcon: (role: string) => React.ReactNode
  getRoleBadgeColor: (role: string) => string
}

function MemberItem({
  member,
  canManage,
  currentOrgRole,
  user,
  handleUpdateRole,
  handleRemoveMember,
  handleTransferOwnership,
  getRoleIcon,
  getRoleBadgeColor,
}: Readonly<MemberItemProps>) {
  const [isEditingOwner, setIsEditingOwner] = useState(false)
  const [newOwnerEmail, setNewOwnerEmail] = useState(member.users?.email || "")
  const [saving, setSaving] = useState(false)

  const canEditMember = canManage && member.role !== "owner" && member.user_id !== user?.id
  const isOwner = member.role === "owner"
  const isCurrentUserOwner = currentOrgRole === "owner"
  const canTransferOwnership = isOwner && isCurrentUserOwner && handleTransferOwnership

  const handleSaveOwnerChange = async () => {
    if (!handleTransferOwnership || newOwnerEmail === member.users?.email) {
      setIsEditingOwner(false)
      return
    }

    setSaving(true)
    try {
      const success = await handleTransferOwnership(newOwnerEmail)
      if (success) {
        setIsEditingOwner(false)
      }
    } finally {
      setSaving(false)
    }
  }

  const handleCancelEdit = () => {
    setNewOwnerEmail(member.users?.email || "")
    setIsEditingOwner(false)
  }

  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
      <div className="flex items-center gap-3 flex-1">
        <Avatar className="h-10 w-10">
          <AvatarFallback>
            {member.users?.full_name?.charAt(0) ||
              member.users?.email?.charAt(0)?.toUpperCase() ||
              "U"}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <p className="font-medium text-gray-900">
            {member.users?.full_name || member.users?.email || "Unknown User"}
          </p>
          {isEditingOwner ? (
            <div className="flex items-center gap-2 mt-1">
              <Input
                type="email"
                value={newOwnerEmail}
                onChange={(e) => setNewOwnerEmail(e.target.value)}
                placeholder="Enter new owner email"
                className="h-8 text-sm max-w-xs"
                disabled={saving}
              />
              <Button
                size="sm"
                variant="ghost"
                onClick={handleSaveOwnerChange}
                disabled={saving || !newOwnerEmail.trim()}
                className="h-8 px-2 text-green-600 hover:text-green-700 hover:bg-green-50"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleCancelEdit}
                disabled={saving}
                className="h-8 px-2 text-gray-600 hover:text-gray-700"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <p className="text-sm text-gray-500">{member.users?.email}</p>
              {canTransferOwnership && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setIsEditingOwner(true)}
                  className="h-6 px-1 text-gray-400 hover:text-gray-600"
                  title="Transfer ownership to another user"
                >
                  <Pencil className="h-3 w-3" />
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3">
        {getRoleIcon(member.role)}
        {canEditMember ? (
          <Select value={member.role} onValueChange={(value) => handleUpdateRole(member.id, value)}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="viewer">Viewer</SelectItem>
              <SelectItem value="member">Member</SelectItem>
              {currentOrgRole === "owner" && <SelectItem value="admin">Admin</SelectItem>}
            </SelectContent>
          </Select>
        ) : (
          <Badge className={getRoleBadgeColor(member.role)}>{member.role}</Badge>
        )}
        {canEditMember && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700">
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remove Member</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to remove {member.users?.email} from this organization?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => handleRemoveMember(member.id)}
                  className="bg-red-600 hover:bg-red-700"
                >
                  Remove
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </div>
  )
}

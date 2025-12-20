"use client"

import type React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Users,
  Settings,
  Mail,
  User,
  Shield,
  CheckCircle,
  XCircle,
  Loader2,
  Clock,
  Search,
  Lock,
  Unlock,
  FileSpreadsheet,
} from "lucide-react"

// Helper function to get status badge color
function getStatusBadgeColor(status: string | null): string {
  if (status === "pre_registered") return "bg-blue-500"
  if (status === "accepted") return "bg-green-500"
  return ""
}

// Helper function to get lockout status message
function getLockoutStatusMessage(
  isLocked: boolean,
  lockoutInfo: { failed_attempt_count: number; max_failed_attempts: number }
): string {
  if (isLocked) {
    return `Locked due to ${lockoutInfo.failed_attempt_count} failed login attempts`
  }
  if (lockoutInfo.failed_attempt_count > 0) {
    return `${lockoutInfo.failed_attempt_count} of ${lockoutInfo.max_failed_attempts} failed attempts`
  }
  return "No recent failed login attempts"
}

interface SearchedUser {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  created_at: string
  updated_at: string | null
  phone: string | null
  hub_mode: string | null
  region: string | null
  division: string | null
  email_verified: boolean
  lockout_info?: {
    is_locked_out: boolean
    failed_attempt_count: number
    max_failed_attempts: number
    lockout_duration_minutes: number
    lockout_expires_at: string | null
    last_failed_attempt: string | null
  }
}

interface SearchedPreregInfo {
  is_preregistered: boolean
  status: string | null
  role: string | null
  invited_at: string | null
  record_exists: boolean
}

interface SearchedMembershipInfo {
  is_member: boolean
  role: string | null
  status: string | null
  joined_at: string | null
}

interface SearchedOrgInfo {
  org_id: string
  org_name: string
  require_preregistration: boolean
  domain: string | null
  allowed_domains?: string[]
}

interface AccountTabProps {
  requirePreregistration: boolean
  savingPreregSetting: boolean
  handleTogglePreregistration: () => void
  searchEmail: string
  setSearchEmail: (email: string) => void
  searchingUser: boolean
  handleUserSearch: () => void
  searchError: string | null
  searchAllowedDomains: string[]
  searchedUser: SearchedUser | null
  searchedPreregInfo: SearchedPreregInfo | null
  searchedMembershipInfo: SearchedMembershipInfo | null
  searchedOrgInfo: SearchedOrgInfo | null
  searchedEmail: string | null
  searchedMessage: string | null
  unlockingAccount: boolean
  handleUnlockAccount: () => void
  getRoleIcon: (role: string) => React.ReactNode
}

export function AccountTab({
  requirePreregistration,
  savingPreregSetting,
  handleTogglePreregistration,
  searchEmail,
  setSearchEmail,
  searchingUser,
  handleUserSearch,
  searchError,
  searchAllowedDomains,
  searchedUser,
  searchedPreregInfo,
  searchedMembershipInfo,
  searchedOrgInfo,
  searchedEmail,
  searchedMessage,
  unlockingAccount,
  handleUnlockAccount,
  getRoleIcon,
}: Readonly<AccountTabProps>) {
  return (
    <>
      <PreRegistrationSecurityCard
        requirePreregistration={requirePreregistration}
        savingPreregSetting={savingPreregSetting}
        handleTogglePreregistration={handleTogglePreregistration}
      />

      <UserAccessTroubleshootingCard
        searchEmail={searchEmail}
        setSearchEmail={setSearchEmail}
        searchingUser={searchingUser}
        handleUserSearch={handleUserSearch}
        searchError={searchError}
        searchAllowedDomains={searchAllowedDomains}
        searchedUser={searchedUser}
        searchedPreregInfo={searchedPreregInfo}
        searchedMembershipInfo={searchedMembershipInfo}
        searchedOrgInfo={searchedOrgInfo}
        searchedEmail={searchedEmail}
        searchedMessage={searchedMessage}
        unlockingAccount={unlockingAccount}
        handleUnlockAccount={handleUnlockAccount}
        getRoleIcon={getRoleIcon}
      />

      <AuthenticationSecurityCard />
    </>
  )
}

interface PreRegistrationSecurityCardProps {
  requirePreregistration: boolean
  savingPreregSetting: boolean
  handleTogglePreregistration: () => void
}

function PreRegistrationSecurityCard({
  requirePreregistration,
  savingPreregSetting,
  handleTogglePreregistration,
}: Readonly<PreRegistrationSecurityCardProps>) {
  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-indigo-600" />
          Pre-Registration Security
        </CardTitle>
        <CardDescription>
          Control who can access your organization by requiring pre-registration
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          className={`p-4 rounded-lg border ${requirePreregistration ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200"}`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {requirePreregistration ? (
                <Lock className="h-6 w-6 text-green-600" />
              ) : (
                <Unlock className="h-6 w-6 text-amber-600" />
              )}
              <div>
                <h4 className={`font-semibold ${requirePreregistration ? "text-green-900" : "text-amber-900"}`}>
                  {requirePreregistration ? "Pre-Registration Required" : "Open Registration"}
                </h4>
                <p className={`text-sm ${requirePreregistration ? "text-green-700" : "text-amber-700"}`}>
                  {requirePreregistration
                    ? "Only pre-registered emails can join your organization"
                    : "Anyone with your domain email can join automatically"}
                </p>
              </div>
            </div>
            <Button
              onClick={handleTogglePreregistration}
              disabled={savingPreregSetting}
              variant={requirePreregistration ? "outline" : "default"}
            >
              {savingPreregSetting && <Loader2 className="h-4 w-4 animate-spin" />}
              {!savingPreregSetting && (requirePreregistration ? "Disable" : "Enable")}
            </Button>
          </div>
        </div>

        <PreRegistrationFlowExplanation />
      </CardContent>
    </Card>
  )
}

function PreRegistrationFlowExplanation() {
  const steps = [
    { num: "1", title: "Admin imports email list", desc: "Go to Members tab → Import from CSV File → Upload CSV with approved emails" },
    { num: "2", title: "Emails are pre-registered (no invitation sent)", desc: "User is added to the allowed list without notification" },
    { num: "3", title: "User attempts to sign up", desc: "System checks if their email is in the pre-registered list" },
  ]

  return (
    <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 p-4 border border-blue-200 dark:border-blue-800">
      <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-3">
        How Pre-Registration Security Works
      </h4>
      <div className="space-y-3">
        {steps.map((step) => (
          <div key={step.num} className="flex items-start gap-3">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-200 dark:bg-blue-800 flex items-center justify-center text-sm font-medium text-blue-800 dark:text-blue-200">
              {step.num}
            </div>
            <div>
              <p className="text-sm font-medium text-blue-900 dark:text-blue-100">{step.title}</p>
              <p className="text-xs text-blue-700 dark:text-blue-300">{step.desc}</p>
            </div>
          </div>
        ))}
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-200 dark:bg-green-800 flex items-center justify-center text-sm font-medium text-green-800 dark:text-green-200">
            ✓
          </div>
          <div>
            <p className="text-sm font-medium text-green-900 dark:text-green-100">Pre-registered: Access granted</p>
            <p className="text-xs text-green-700 dark:text-green-300">User is automatically added as organization member</p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-6 h-6 rounded-full bg-red-200 dark:bg-red-800 flex items-center justify-center text-sm font-medium text-red-800 dark:text-red-200">
            ✗
          </div>
          <div>
            <p className="text-sm font-medium text-red-900 dark:text-red-100">Not pre-registered: Access denied</p>
            <p className="text-xs text-red-700 dark:text-red-300">User sees &quot;Access Denied&quot; page with instructions to contact admin</p>
          </div>
        </div>
      </div>
    </div>
  )
}

interface UserAccessTroubleshootingCardProps {
  searchEmail: string
  setSearchEmail: (email: string) => void
  searchingUser: boolean
  handleUserSearch: () => void
  searchError: string | null
  searchAllowedDomains: string[]
  searchedUser: SearchedUser | null
  searchedPreregInfo: SearchedPreregInfo | null
  searchedMembershipInfo: SearchedMembershipInfo | null
  searchedOrgInfo: SearchedOrgInfo | null
  searchedEmail: string | null
  searchedMessage: string | null
  unlockingAccount: boolean
  handleUnlockAccount: () => void
  getRoleIcon: (role: string) => React.ReactNode
}

function UserAccessTroubleshootingCard({
  searchEmail,
  setSearchEmail,
  searchingUser,
  handleUserSearch,
  searchError,
  searchAllowedDomains,
  searchedUser,
  searchedPreregInfo,
  searchedMembershipInfo,
  searchedOrgInfo,
  searchedEmail,
  searchedMessage,
  unlockingAccount,
  handleUnlockAccount,
  getRoleIcon,
}: Readonly<UserAccessTroubleshootingCardProps>) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="h-5 w-5 text-blue-600" />
          User Access Troubleshooting
        </CardTitle>
        <CardDescription>
          Search for a user by email to check their access status and troubleshoot issues
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex gap-4">
          <div className="flex-1">
            <Input
              placeholder="Enter email address..."
              value={searchEmail}
              onChange={(e) => setSearchEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleUserSearch()}
            />
          </div>
          <Button onClick={handleUserSearch} disabled={searchingUser}>
            {searchingUser ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            <span className="ml-2">Search</span>
          </Button>
        </div>

        {searchError && (
          <SearchErrorDisplay searchError={searchError} searchAllowedDomains={searchAllowedDomains} />
        )}

        {(searchedUser || searchedPreregInfo || searchedMessage) && (
          <SearchResultsDisplay
            searchedUser={searchedUser}
            searchedPreregInfo={searchedPreregInfo}
            searchedMembershipInfo={searchedMembershipInfo}
            searchedOrgInfo={searchedOrgInfo}
            searchedEmail={searchedEmail}
            searchedMessage={searchedMessage}
            unlockingAccount={unlockingAccount}
            handleUnlockAccount={handleUnlockAccount}
            getRoleIcon={getRoleIcon}
          />
        )}
      </CardContent>
    </Card>
  )
}

interface SearchErrorDisplayProps {
  searchError: string
  searchAllowedDomains: string[]
}

function SearchErrorDisplay({ searchError, searchAllowedDomains }: Readonly<SearchErrorDisplayProps>) {
  return (
    <div className="p-4 bg-red-50 border border-red-200 rounded-lg space-y-3">
      <p className="text-red-700">{searchError}</p>
      {searchAllowedDomains.length > 0 && (
        <div className="pt-2 border-t border-red-200">
          <p className="text-sm text-red-600 font-medium mb-2">
            You can only search for users with these domains:
          </p>
          <div className="flex flex-wrap gap-2">
            {searchAllowedDomains.map((domain) => (
              <Badge key={domain} variant="outline" className="bg-white text-red-700 border-red-300">
                @{domain}
              </Badge>
            ))}
          </div>
        </div>
      )}
      {searchAllowedDomains.length === 0 && searchError.includes("No domains configured") && (
        <div className="pt-2 border-t border-red-200">
          <p className="text-sm text-red-600">
            Go to the <strong>General</strong> tab and add your organization&apos;s email domains in the
            &quot;Organization Domains&quot; section.
          </p>
        </div>
      )}
    </div>
  )
}

interface SearchResultsDisplayProps {
  searchedUser: SearchedUser | null
  searchedPreregInfo: SearchedPreregInfo | null
  searchedMembershipInfo: SearchedMembershipInfo | null
  searchedOrgInfo: SearchedOrgInfo | null
  searchedEmail: string | null
  searchedMessage: string | null
  unlockingAccount: boolean
  handleUnlockAccount: () => void
  getRoleIcon: (role: string) => React.ReactNode
}

function SearchResultsDisplay({
  searchedUser,
  searchedPreregInfo,
  searchedMembershipInfo,
  searchedOrgInfo,
  searchedEmail,
  searchedMessage,
  unlockingAccount,
  handleUnlockAccount,
  getRoleIcon,
}: Readonly<SearchResultsDisplayProps>) {
  return (
    <div className="space-y-6">
      <AccessStatusSummary
        searchedUser={searchedUser}
        searchedPreregInfo={searchedPreregInfo}
        searchedMembershipInfo={searchedMembershipInfo}
        searchedOrgInfo={searchedOrgInfo}
        searchedEmail={searchedEmail}
        searchedMessage={searchedMessage}
      />

      {searchedPreregInfo && (
        <PreRegistrationStatusCard
          searchedPreregInfo={searchedPreregInfo}
          searchedOrgInfo={searchedOrgInfo}
        />
      )}

      {searchedMembershipInfo && (
        <OrganizationMembershipCard
          searchedMembershipInfo={searchedMembershipInfo}
          getRoleIcon={getRoleIcon}
        />
      )}

      {searchedOrgInfo && <OrganizationSettingsCard searchedOrgInfo={searchedOrgInfo} />}

      {searchedUser && (
        <UserDetailsSection
          searchedUser={searchedUser}
          unlockingAccount={unlockingAccount}
          handleUnlockAccount={handleUnlockAccount}
        />
      )}
    </div>
  )
}

interface AccessStatusSummaryProps {
  searchedUser: SearchedUser | null
  searchedPreregInfo: SearchedPreregInfo | null
  searchedMembershipInfo: SearchedMembershipInfo | null
  searchedOrgInfo: SearchedOrgInfo | null
  searchedEmail: string | null
  searchedMessage: string | null
}

function AccessStatusSummary({
  searchedUser,
  searchedPreregInfo,
  searchedMembershipInfo,
  searchedOrgInfo,
  searchedEmail,
  searchedMessage,
}: Readonly<AccessStatusSummaryProps>) {
  const isMember = searchedUser && searchedMembershipInfo?.is_member
  const isPreregistered = searchedPreregInfo?.is_preregistered

  const getStatusConfig = () => {
    if (isMember) {
      return {
        bgColor: "bg-green-50 border-green-200",
        textColor: "text-green-900",
        descColor: "text-green-700",
        icon: <CheckCircle className="h-6 w-6 text-green-600" />,
        title: "Active Member",
      }
    }
    if (isPreregistered) {
      return {
        bgColor: "bg-blue-50 border-blue-200",
        textColor: "text-blue-900",
        descColor: "text-blue-700",
        icon: <Clock className="h-6 w-6 text-blue-600" />,
        title: "Pre-Registered (Awaiting Sign-up)",
      }
    }
    return {
      bgColor: "bg-red-50 border-red-200",
      textColor: "text-red-900",
      descColor: "text-red-700",
      icon: <XCircle className="h-6 w-6 text-red-600" />,
      title: searchedOrgInfo?.require_preregistration
        ? "Not Pre-Registered - Access Will Be Denied"
        : "Not Pre-Registered - Can Join Freely",
    }
  }

  const config = getStatusConfig()

  return (
    <div className={`p-4 rounded-lg border ${config.bgColor}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {config.icon}
          <div>
            <h3 className={`font-semibold ${config.textColor}`}>{config.title}</h3>
            <p className={`text-sm ${config.descColor}`}>{searchedEmail}</p>
            {searchedMessage && <p className="text-xs mt-1 text-gray-600">{searchedMessage}</p>}
          </div>
        </div>
      </div>
    </div>
  )
}

interface PreRegistrationStatusCardProps {
  searchedPreregInfo: SearchedPreregInfo
  searchedOrgInfo: SearchedOrgInfo | null
}

function PreRegistrationStatusCard({ searchedPreregInfo, searchedOrgInfo }: Readonly<PreRegistrationStatusCardProps>) {
  return (
    <Card className="border-2">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <FileSpreadsheet className="h-4 w-4 text-indigo-600" />
          Pre-Registration Status
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3">
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <span className="text-sm text-gray-600">Record Exists</span>
            <Badge variant={searchedPreregInfo.record_exists ? "default" : "secondary"}>
              {searchedPreregInfo.record_exists ? "Yes" : "No"}
            </Badge>
          </div>
          {searchedPreregInfo.record_exists && (
            <>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-600">Status</span>
                <Badge
                  variant={
                    searchedPreregInfo.status === "pre_registered" || searchedPreregInfo.status === "accepted"
                      ? "default"
                      : "secondary"
                  }
                  className={getStatusBadgeColor(searchedPreregInfo.status)}
                >
                  {searchedPreregInfo.status?.replace("_", " ") || "Unknown"}
                </Badge>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-600">Assigned Role</span>
                <span className="text-sm font-medium capitalize">
                  {searchedPreregInfo.role || "member"}
                </span>
              </div>
              {searchedPreregInfo.invited_at && (
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm text-gray-600">Pre-Registered On</span>
                  <span className="text-sm">
                    {new Date(searchedPreregInfo.invited_at).toLocaleDateString()}
                  </span>
                </div>
              )}
            </>
          )}
          {!searchedPreregInfo.record_exists && searchedOrgInfo?.require_preregistration && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-800">
                <strong>Action Required:</strong> This email needs to be pre-registered before the
                user can access the organization. Use the &quot;Import Members&quot; feature in the Members tab
                to add this email.
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

interface OrganizationMembershipCardProps {
  searchedMembershipInfo: SearchedMembershipInfo
  getRoleIcon: (role: string) => React.ReactNode
}

function OrganizationMembershipCard({ searchedMembershipInfo, getRoleIcon }: Readonly<OrganizationMembershipCardProps>) {
  return (
    <Card className="border-2">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="h-4 w-4 text-green-600" />
          Organization Membership
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3">
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <span className="text-sm text-gray-600">Is Member</span>
            <Badge variant={searchedMembershipInfo.is_member ? "default" : "secondary"}>
              {searchedMembershipInfo.is_member ? "Yes" : "No"}
            </Badge>
          </div>
          {searchedMembershipInfo.is_member && (
            <>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-600">Role</span>
                <div className="flex items-center gap-2">
                  {getRoleIcon(searchedMembershipInfo.role || "member")}
                  <span className="text-sm font-medium capitalize">
                    {searchedMembershipInfo.role}
                  </span>
                </div>
              </div>
              {searchedMembershipInfo.joined_at && (
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm text-gray-600">Joined</span>
                  <span className="text-sm">
                    {new Date(searchedMembershipInfo.joined_at).toLocaleDateString()}
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

interface OrganizationSettingsCardProps {
  searchedOrgInfo: SearchedOrgInfo
}

function OrganizationSettingsCard({ searchedOrgInfo }: Readonly<OrganizationSettingsCardProps>) {
  return (
    <Card className="border-2">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Settings className="h-4 w-4 text-gray-600" />
          Organization Access Settings
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3">
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <span className="text-sm text-gray-600">Organization</span>
            <span className="text-sm font-medium">{searchedOrgInfo.org_name}</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <span className="text-sm text-gray-600">Domain</span>
            <span className="text-sm">{searchedOrgInfo.domain || "Not set"}</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <span className="text-sm text-gray-600">Pre-Registration Required</span>
            <Badge variant={searchedOrgInfo.require_preregistration ? "default" : "secondary"}>
              {searchedOrgInfo.require_preregistration ? "Yes" : "No"}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

interface UserDetailsSectionProps {
  searchedUser: SearchedUser
  unlockingAccount: boolean
  handleUnlockAccount: () => void
}

function UserDetailsSection({ searchedUser, unlockingAccount, handleUnlockAccount }: Readonly<UserDetailsSectionProps>) {
  return (
    <>
      {searchedUser.lockout_info && (
        <LockoutStatusCard
          lockoutInfo={searchedUser.lockout_info}
          unlockingAccount={unlockingAccount}
          handleUnlockAccount={handleUnlockAccount}
        />
      )}

      <AccountInformationCard searchedUser={searchedUser} />
    </>
  )
}

interface LockoutStatusCardProps {
  lockoutInfo: NonNullable<SearchedUser["lockout_info"]>
  unlockingAccount: boolean
  handleUnlockAccount: () => void
}

function LockoutStatusCard({ lockoutInfo, unlockingAccount, handleUnlockAccount }: Readonly<LockoutStatusCardProps>) {
  const isLocked = lockoutInfo.is_locked_out

  return (
    <div
      className={`p-4 rounded-lg border ${isLocked ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200"}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {isLocked ? (
            <Lock className="h-6 w-6 text-red-600" />
          ) : (
            <Unlock className="h-6 w-6 text-green-600" />
          )}
          <div>
            <h4 className={`font-semibold ${isLocked ? "text-red-900" : "text-green-900"}`}>
              {isLocked ? "Account Locked" : "Account Active"}
            </h4>
            <p className={`text-sm ${isLocked ? "text-red-700" : "text-green-700"}`}>
              {getLockoutStatusMessage(isLocked, lockoutInfo)}
            </p>
            {isLocked && lockoutInfo.lockout_expires_at && (
              <p className="text-xs text-red-600 mt-1">
                Auto-unlocks at: {new Date(lockoutInfo.lockout_expires_at).toLocaleString()}
              </p>
            )}
          </div>
        </div>
        {isLocked && (
          <Button onClick={handleUnlockAccount} disabled={unlockingAccount} variant="destructive" size="sm">
            {unlockingAccount ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Unlocking...
              </>
            ) : (
              <>
                <Unlock className="h-4 w-4 mr-2" />
                Unlock Account
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  )
}

interface AccountInformationCardProps {
  searchedUser: SearchedUser
}

function AccountInformationCard({ searchedUser }: Readonly<AccountInformationCardProps>) {
  return (
    <div className="p-6 bg-gray-50 border rounded-lg space-y-4">
      <h4 className="font-semibold text-gray-900">Account Information</h4>

      <div className="p-4 bg-white border rounded-lg flex items-center gap-3">
        <User className="h-5 w-5 text-gray-400" />
        <div>
          <p className="text-xs text-gray-500">User ID</p>
          <p className="font-mono text-sm">{searchedUser.id}</p>
        </div>
      </div>

      <div className="p-4 bg-white border rounded-lg flex items-center gap-3">
        <Mail className="h-5 w-5 text-gray-400" />
        <div>
          <p className="text-xs text-gray-500">Email</p>
          <p className="text-sm">{searchedUser.email}</p>
        </div>
      </div>

      <div className="p-4 bg-white border rounded-lg flex items-center gap-3">
        <Clock className="h-5 w-5 text-gray-400" />
        <div>
          <p className="text-xs text-gray-500">Email Verified</p>
          <p className={`text-sm font-medium ${searchedUser.email_verified ? "text-green-600" : "text-orange-500"}`}>
            {searchedUser.email_verified ? "Verified" : "Not verified"}
          </p>
        </div>
      </div>

      {searchedUser.full_name && (
        <div className="p-4 bg-white border rounded-lg flex items-center gap-3">
          <User className="h-5 w-5 text-gray-400" />
          <div>
            <p className="text-xs text-gray-500">Full Name</p>
            <p className="text-sm">{searchedUser.full_name}</p>
          </div>
        </div>
      )}

      <div className="p-4 bg-white border rounded-lg flex items-center gap-3">
        <Clock className="h-5 w-5 text-gray-400" />
        <div>
          <p className="text-xs text-gray-500">Account Created</p>
          <p className="text-sm">
            {new Date(searchedUser.created_at).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
      </div>
    </div>
  )
}

function AuthenticationSecurityCard() {
  const securityFeatures = [
    {
      icon: <CheckCircle className="h-4 w-4 text-green-600" />,
      title: "Password Security",
      badge: "Built-in",
      badgeColor: "bg-green-100 text-green-700",
      borderColor: "border-green-200",
      items: ["Passwords hashed with bcrypt automatically", "Salt generated per password", "Plain text passwords never stored"],
    },
    {
      icon: <CheckCircle className="h-4 w-4 text-green-600" />,
      title: "JWT Authentication",
      badge: "Built-in",
      badgeColor: "bg-green-100 text-green-700",
      borderColor: "border-green-200",
      items: ["Access tokens issued on login", "Refresh tokens for session renewal", "Configurable expiration times"],
    },
    {
      icon: <CheckCircle className="h-4 w-4 text-green-600" />,
      title: "Row Level Security",
      badge: "PostgreSQL RLS",
      badgeColor: "bg-green-100 text-green-700",
      borderColor: "border-green-200",
      items: ["Database-level access control", "Policies enforce data ownership", "Users only see their own data"],
    },
    {
      icon: <Lock className="h-4 w-4 text-indigo-600" />,
      title: "Pre-Registration Control",
      badge: "Custom Implementation",
      badgeColor: "bg-indigo-100 text-indigo-700",
      borderColor: "border-indigo-200",
      items: ["CSV import for bulk pre-registration", "Email whitelist before sign-up", "Domain-based organization matching"],
    },
  ]

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-blue-600" />
          Authentication Security
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-2 gap-4">
          {securityFeatures.map((feature) => (
            <div key={feature.title} className={`p-4 bg-white rounded-lg border ${feature.borderColor}`}>
              <div className="flex items-center gap-2 mb-2">
                {feature.icon}
                <h5 className="font-medium text-gray-900">{feature.title}</h5>
                <span className={`text-xs ${feature.badgeColor} px-2 py-0.5 rounded`}>{feature.badge}</span>
              </div>
              <ul className="text-sm text-gray-600 space-y-1">
                {feature.items.map((item) => (
                  <li key={item}>• {item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

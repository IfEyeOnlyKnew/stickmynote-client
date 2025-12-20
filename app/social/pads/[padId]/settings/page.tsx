import { createDatabaseClient } from "@/lib/database/database-adapter"
import { redirect } from "next/navigation"
import { CleanupPolicySettings } from "@/components/social/cleanup-policy-settings"
import { BreadcrumbNav } from "@/components/breadcrumb-nav"
import { UserMenu } from "@/components/user-menu"

export default async function PadSettingsPage({
  params,
}: {
  params: Promise<{ padId: string }>
}) {
  const { padId } = await params
  const db = await createDatabaseClient()

  const {
    data: { user },
  } = await db.auth.getUser()
  if (!user) {
    redirect("/auth")
  }

  // Get pad and verify ownership
  const { data: pad } = await db.from("social_pads").select("id, name, owner_id").eq("id", padId).single()

  if (!pad) {
    redirect("/social")
  }

  // Check if user is owner or admin
  const isOwner = pad.owner_id === user.id

  const { data: membership } = await db
    .from("social_pad_members")
    .select("role")
    .eq("social_pad_id", padId)
    .eq("user_id", user.id)
    .single()

  const isAdmin = membership?.role === "admin" || membership?.role === "owner"

  if (!isOwner && !isAdmin) {
    redirect(`/social/pads/${padId}`)
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <BreadcrumbNav
          items={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Social Hub", href: "/social" },
            { label: pad.name, href: `/social/pads/${padId}` },
            { label: "Settings", current: true },
          ]}
        />
        <UserMenu />
      </div>

      <CleanupPolicySettings padId={padId} padName={pad.name} />
    </div>
  )
}

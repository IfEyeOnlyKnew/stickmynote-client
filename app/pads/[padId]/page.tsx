import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { PadPageClient } from "./page-client"

async function getPadWithSticks(padId: string) {
  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect("/auth/login")
  }

  const userEmail = user.email
  if (userEmail) {
    const { data: pendingInvites } = await supabase
      .from("paks_pad_pending_invites")
      .select("*")
      .eq("pad_id", padId)
      .eq("email", userEmail)

    if (pendingInvites && pendingInvites.length > 0) {
      console.log("[v0] Found pending pad invite for user, auto-accepting...")

      for (const invite of pendingInvites) {
        const { error: memberError } = await supabase.from("paks_pad_members").insert({
          pad_id: invite.pad_id,
          user_id: user.id,
          role: invite.role,
          accepted: true,
          joined_at: new Date().toISOString(),
        })

        if (!memberError) {
          await supabase.from("paks_pad_pending_invites").delete().eq("id", invite.id)

          console.log("[v0] Auto-accepted pad invite successfully")
        } else {
          console.error("[v0] Error auto-accepting pad invite:", memberError)
        }
      }
    }

    const { data: unacceptedMembers, error: unacceptedError } = await supabase
      .from("paks_pad_members")
      .select("*")
      .eq("pad_id", padId)
      .eq("user_id", user.id)
      .eq("accepted", false)

    if (!unacceptedError && unacceptedMembers && unacceptedMembers.length > 0) {
      console.log("[v0] Found unaccepted pad membership, auto-accepting...")

      for (const member of unacceptedMembers) {
        const { error: acceptError } = await supabase
          .from("paks_pad_members")
          .update({
            accepted: true,
            joined_at: new Date().toISOString(),
          })
          .eq("id", member.id)

        if (!acceptError) {
          console.log("[v0] Auto-accepted pad membership successfully")
        } else {
          console.error("[v0] Error auto-accepting pad membership:", acceptError)
        }
      }
    }
  }

  const { data: pad, error: padError } = await supabase.from("paks_pads").select("*").eq("id", padId).single()

  if (padError || !pad) {
    redirect("/mypads")
  }

  const isPadOwner = pad.owner_id === user.id

  const { data: padMembership, error: padMembershipError } = await supabase
    .from("paks_pad_members")
    .select("role")
    .eq("pad_id", padId)
    .eq("user_id", user.id)
    .eq("accepted", true)
    .maybeSingle()

  let userRole: string | null = null

  if (isPadOwner) {
    userRole = "admin"
  } else if (padMembership?.role) {
    const roleMapping: { [key: string]: string } = {
      edit: "editor",
      view: "viewer",
      admin: "admin",
      editor: "editor",
      viewer: "viewer",
      owner: "owner",
    }
    userRole = roleMapping[padMembership.role.toLowerCase()] || padMembership.role
  }

  if (!userRole && !isPadOwner && !padMembership) {
    redirect("/mypads")
  }

  let sticks = []
  let retryCount = 0
  const maxRetries = 3

  while (retryCount < maxRetries) {
    try {
      const { data: sticksData, error: sticksError } = await supabase
        .from("paks_pad_sticks")
        .select("*")
        .eq("pad_id", padId)
        .order("created_at", { ascending: false })

      if (sticksError) {
        console.error(`Error fetching sticks (attempt ${retryCount + 1}):`, sticksError)

        if (sticksError.message?.includes("Too Many") || sticksError.code === "429") {
          retryCount++
          if (retryCount < maxRetries) {
            console.log(`Rate limited, waiting ${retryCount * 1000}ms before retry...`)
            await new Promise((resolve) => setTimeout(resolve, retryCount * 1000))
            continue
          }
        }

        console.error("Failed to fetch sticks after retries, returning empty array")
        break
      }

      sticks = sticksData || []
      break
    } catch (error) {
      console.error(`Unexpected error fetching sticks (attempt ${retryCount + 1}):`, error)
      retryCount++
      if (retryCount < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, retryCount * 1000))
      }
    }
  }

  return { pad, sticks, user, userRole }
}

export default async function PadPage({ params }: { params: { padId: string } }) {
  const { pad, sticks, userRole } = await getPadWithSticks(params.padId)

  return <PadPageClient pad={pad} sticks={sticks} userRole={userRole} />
}

import { createServerClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ accountId: string }> }) {
  try {
    const { accountId } = await params
    const supabase = await createServerClient()

    const authResult = await getCachedAuthUser(supabase)
    if (authResult.rateLimited) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again in a moment." },
        { status: 429, headers: { "Retry-After": "30" } },
      )
    }
    if (!authResult.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const user = authResult.user

    const { data: account } = await supabase
      .from("social_accounts")
      .select("owner_id")
      .eq("id", accountId)
      .maybeSingle()

    if (!account || account.owner_id !== user.id) {
      return NextResponse.json({ error: "Account not found or unauthorized" }, { status: 404 })
    }

    const { error } = await supabase.from("social_accounts").delete().eq("id", accountId)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting account:", error)
    return NextResponse.json({ error: "Failed to delete account" }, { status: 500 })
  }
}

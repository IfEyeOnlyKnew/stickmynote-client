import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/server"
import { put } from "@vercel/blob"
import { getCachedAuthUser } from "@/lib/auth/cached-auth"

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/svg+xml"]

// POST /api/organizations/[orgId]/branding/upload - Upload logo
export async function POST(req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  try {
    const { orgId } = await params
    const supabase = await createClient()
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
    const serviceClient = createServiceClient()

    // Check admin/owner role
    const { data: membership, error: memberError } = await serviceClient
      .from("organization_members")
      .select("role")
      .eq("org_id", orgId)
      .eq("user_id", user.id)
      .maybeSingle()

    if (memberError || !membership) {
      return NextResponse.json({ error: "Not a member of this organization" }, { status: 403 })
    }

    if (membership.role !== "owner" && membership.role !== "admin") {
      return NextResponse.json({ error: "Only owners and admins can upload branding" }, { status: 403 })
    }

    // Parse multipart form data
    const formData = await req.formData()
    const file = formData.get("file") as File | null
    const type = formData.get("type") as string // 'logo' or 'logo_dark' or 'favicon'

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    // Validate file
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File too large. Max 5MB" }, { status: 400 })
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: "Invalid file type. Use PNG, JPG, WEBP, or SVG" }, { status: 400 })
    }

    // Generate unique filename
    const timestamp = Date.now()
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
    const filename = `orgs/${orgId}/branding/${type || "logo"}-${timestamp}-${sanitizedName}`

    // Upload to Vercel Blob
    const blob = await put(filename, file, {
      access: "public",
    })

    // Update organization settings with new URL
    const { data: org, error: fetchError } = await serviceClient
      .from("organizations")
      .select("settings")
      .eq("id", orgId)
      .single()

    if (fetchError || !org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 })
    }

    const currentSettings = (org.settings as Record<string, unknown>) || {}
    const currentBranding = (currentSettings.branding as Record<string, unknown>) || {}

    let updatedBranding = { ...currentBranding }

    if (type === "logo_dark") {
      updatedBranding = { ...updatedBranding, logo_dark_url: blob.url }
    } else if (type === "favicon") {
      updatedBranding = { ...updatedBranding, favicon_url: blob.url }
    } else if (type === "page_logo") {
      updatedBranding = { ...updatedBranding, page_logo_url: blob.url }
    } else {
      updatedBranding = { ...updatedBranding, logo_url: blob.url }
    }

    const updatedSettings = {
      ...currentSettings,
      branding: updatedBranding,
    }

    const { error: updateError } = await serviceClient
      .from("organizations")
      .update({ settings: updatedSettings, updated_at: new Date().toISOString() })
      .eq("id", orgId)

    if (updateError) {
      console.error("[v0] Error updating organization branding:", updateError)
      return NextResponse.json({ error: "Failed to save branding" }, { status: 500 })
    }

    return NextResponse.json({ url: blob.url, type })
  } catch (err) {
    console.error("[v0] Unexpected error in POST /api/organizations/[orgId]/branding/upload:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

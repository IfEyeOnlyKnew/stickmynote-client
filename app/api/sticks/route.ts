import type { NextRequest } from "next/server"
import { createSafeAction, success, error } from "@/lib/safe-action"
import { createStickSchema } from "@/types/schemas"
import { getOrgContext } from "@/lib/auth/get-org-context"

const createStickAction = createSafeAction(
  {
    input: createStickSchema,
    rateLimit: "sticks_create",
  },
  async (input, { user, supabase }) => {
    const orgContext = await getOrgContext()
    if (!orgContext) {
      return error("No organization context", 403)
    }

    const { data: pad } = await supabase
      .from("paks_pads")
      .select("owner_id, org_id")
      .eq("id", input.pad_id)
      .eq("org_id", orgContext.orgId)
      .maybeSingle()

    if (!pad) {
      return error("Pad not found", 404)
    }

    const isOwner = pad.owner_id === user.id

    let canCreate = isOwner
    if (!isOwner) {
      const { data: membership } = await supabase
        .from("paks_pad_members")
        .select("role")
        .eq("pad_id", input.pad_id)
        .eq("user_id", user.id)
        .eq("org_id", orgContext.orgId)
        .eq("accepted", true)
        .maybeSingle()

      canCreate = membership?.role === "admin" || membership?.role === "editor"
    }

    if (!canCreate) {
      return error("Insufficient permissions to create Sticks", 403)
    }

    const { data: newStick, error: dbError } = await supabase
      .from("paks_pad_sticks")
      .insert({
        pad_id: input.pad_id,
        topic: input.topic || "",
        content: input.content || "",
        details: input.details || "",
        color: input.color || "#fef3c7",
        position_x: input.position_x || 0,
        position_y: input.position_y || 0,
        user_id: user.id,
        org_id: orgContext.orgId,
      })
      .select()
      .single()

    if (dbError) {
      console.error("Error creating Stick:", dbError)
      return error("Failed to create Stick", 500)
    }

    return success({ stick: newStick })
  },
)

export async function POST(request: NextRequest) {
  return createStickAction(request)
}

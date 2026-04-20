import type { NextRequest } from "next/server"
import { createSafeAction, success, error } from "@/lib/safe-action"
import { createStickSchema } from "@/types/schemas"
import { getOrgContext } from "@/lib/auth/get-org-context"

const createStickAction = createSafeAction(
  {
    input: createStickSchema,
    rateLimit: "sticks_create",
  },
  async (input, { user, db }) => {
    if (!user) {
      return error("Unauthorized", 401)
    }

    const orgContext = await getOrgContext()
    if (!orgContext) {
      return error("No organization context", 403)
    }

    // Find the pad without org_id filter - we'll check permissions separately
    // This allows creating sticks on shared pads from other orgs
    const { data: pad } = await db
      .from("paks_pads")
      .select("owner_id, org_id")
      .eq("id", input.pad_id)
      .maybeSingle()

    if (!pad) {
      return error("Pad not found", 404)
    }

    const isOwner = pad.owner_id === user.id

    let canCreate = isOwner

    if (!isOwner) {
      // Check membership - for shared pads, membership may exist across orgs
      const { data: membership } = await db
        .from("paks_pad_members")
        .select("role")
        .eq("pad_id", input.pad_id)
        .eq("user_id", user.id)
        .eq("accepted", true)
        .maybeSingle()

      canCreate = membership?.role === "admin" || membership?.role === "editor"
    }

    if (!canCreate) {
      return error("Insufficient permissions to create Sticks", 403)
    }

    // Validate parent_stick_id if provided: must exist in the same pad and be
    // top-level. The DB trigger is the final guard; this is for nicer errors.
    if (input.parent_stick_id) {
      const { data: parentStick } = await db
        .from("paks_pad_sticks")
        .select("id, pad_id, parent_stick_id")
        .eq("id", input.parent_stick_id)
        .maybeSingle()

      if (!parentStick) {
        return error("Parent stick not found", 400)
      }
      if (parentStick.pad_id !== input.pad_id) {
        return error("Parent stick belongs to a different pad", 400)
      }
      if (parentStick.parent_stick_id) {
        return error("Sub-sticks can only be one level deep", 400)
      }
    }

    // Use the pad's org_id for the stick, not the user's current org context
    // This keeps sticks in the same org as the pad they belong to
    const { data: newStick, error: dbError } = await db
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
        org_id: pad.org_id,
        parent_stick_id: input.parent_stick_id ?? null,
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

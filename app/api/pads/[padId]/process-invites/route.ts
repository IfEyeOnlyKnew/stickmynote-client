import { NextResponse } from "next/server"

/**
 * Process pending pad invitations
 *
 * NOTE: The paks_pad_pending_invites table was dropped in migration 021
 * as it was empty and unused. This endpoint now returns a no-op response.
 * If email-based invitations are needed in the future, re-create the table
 * and restore the original implementation.
 */
export async function POST() {
  // Table was dropped - return success with no invites to process
  return NextResponse.json({
    success: true,
    processed: false,
    message: "No pending invites found",
  })
}

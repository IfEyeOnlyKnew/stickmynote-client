"use server"

import { NextRequest, NextResponse } from "next/server"
import { createServiceDatabaseClient } from "@/lib/database/service-client"
import bcrypt from "bcryptjs"

// POST - Confirm password reset with token
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token, password } = body

    if (!token || !password) {
      return NextResponse.json({ error: "Token and password are required" }, { status: 400 })
    }

    if (password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 })
    }

    const db = await createServiceDatabaseClient()

    // Find valid token
    const { data: resetToken, error: tokenError } = await db
      .from("password_reset_tokens")
      .select("id, user_id, expires_at, used")
      .eq("token", token)
      .maybeSingle()

    if (!resetToken || tokenError) {
      return NextResponse.json({ error: "Invalid or expired reset token" }, { status: 400 })
    }

    if (resetToken.used) {
      return NextResponse.json({ error: "This reset link has already been used" }, { status: 400 })
    }

    if (new Date(resetToken.expires_at) < new Date()) {
      return NextResponse.json({ error: "This reset link has expired" }, { status: 400 })
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(password, 10)

    // Update user password
    const { error: updateError } = await db
      .from("users")
      .update({ password_hash: passwordHash })
      .eq("id", resetToken.user_id)

    if (updateError) {
      console.error("Password update error:", updateError)
      return NextResponse.json({ error: "Failed to update password" }, { status: 500 })
    }

    // Mark token as used
    await db
      .from("password_reset_tokens")
      .update({ used: true })
      .eq("id", resetToken.id)

    return NextResponse.json({ 
      success: true, 
      message: "Password updated successfully. You can now log in with your new password." 
    })
  } catch (error) {
    console.error("Password reset confirm error:", error)
    return NextResponse.json({ error: "Failed to reset password" }, { status: 500 })
  }
}

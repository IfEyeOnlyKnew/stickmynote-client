import bcrypt from "bcryptjs"
import { SignJWT, jwtVerify } from "jose"
import { cookies } from "next/headers"
import { db } from "@/lib/database/pg-client"

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "default-secret-change-in-production")
const SESSION_DURATION = 7 * 24 * 60 * 60 // 7 days in seconds

export interface User {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  email_verified: boolean
  created_at: string
  updated_at: string
}

export interface Session {
  user: User
  expiresAt: string
}

// Hash password with bcrypt
export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10)
  return bcrypt.hash(password, salt)
}

// Verify password
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

// Create JWT token
export async function createToken(userId: string): Promise<string> {
  const token = await new SignJWT({ userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(JWT_SECRET)

  return token
}

// Verify JWT token
export async function verifyToken(token: string): Promise<{ userId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    return { userId: payload.userId as string }
  } catch (error) {
    console.error("[Auth] Token verification failed:", error)
    return null
  }
}

// Set session cookie
export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set("session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_DURATION,
    path: "/",
  })
}

// Get session from cookie
export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get("session")?.value

  if (!token) {
    return null
  }

  const payload = await verifyToken(token)
  if (!payload) {
    return null
  }

  const result = await db.query<User>(
    `SELECT id, email, full_name, avatar_url, email_verified, created_at, updated_at 
     FROM users WHERE id = $1`,
    [payload.userId],
  )

  if (result.rows.length === 0) {
    return null
  }

  return {
    user: result.rows[0],
    expiresAt: new Date(Date.now() + SESSION_DURATION * 1000).toISOString(),
  }
}

// Clear session cookie
export async function clearSession(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete("session")
}

// Sign up new user
export async function signUp(
  email: string,
  password: string,
  fullName?: string,
): Promise<{ user: User; error?: string }> {
  try {
    // Check if user exists
    const existing = await db.query(`SELECT id FROM users WHERE email = $1`, [email.toLowerCase()])
    if (existing.rows.length > 0) {
      return { user: null as any, error: "Email already registered" }
    }

    // Hash password
    const passwordHash = await hashPassword(password)

    // Create user
    const result = await db.query<User>(
      `INSERT INTO users (email, password_hash, full_name, email_verified, created_at, updated_at)
       VALUES ($1, $2, $3, false, NOW(), NOW())
       RETURNING id, email, full_name, avatar_url, email_verified, created_at, updated_at`,
      [email.toLowerCase(), passwordHash, fullName || null],
    )

    return { user: result.rows[0] }
  } catch (error) {
    console.error("[Auth] Sign up error:", error)
    return { user: null as any, error: "Failed to create account" }
  }
}

// Sign in user
export async function signIn(email: string, password: string): Promise<{ user: User; token: string; error?: string }> {
  try {
    const result = await db.query<User & { password_hash: string }>(
      `SELECT id, email, full_name, avatar_url, email_verified, created_at, updated_at, password_hash
       FROM users WHERE email = $1`,
      [email.toLowerCase()],
    )

    if (result.rows.length === 0) {
      return { user: null as any, token: "", error: "Invalid email or password" }
    }

    const user = result.rows[0]

    // Verify password
    const valid = await verifyPassword(password, user.password_hash)
    if (!valid) {
      return { user: null as any, token: "", error: "Invalid email or password" }
    }

    // Create token
    const token = await createToken(user.id)

    // Remove password_hash from returned user
    const { password_hash, ...userWithoutPassword } = user

    return { user: userWithoutPassword as User, token }
  } catch (error) {
    console.error("[Auth] Sign in error:", error)
    return { user: null as any, token: "", error: "Failed to sign in" }
  }
}

// Get user by ID
export async function getUserById(userId: string): Promise<User | null> {
  const result = await db.query<User>(
    `SELECT id, email, full_name, avatar_url, email_verified, created_at, updated_at 
     FROM users WHERE id = $1`,
    [userId],
  )

  return result.rows[0] || null
}

// Update user
export async function updateUser(
  userId: string,
  updates: Partial<Pick<User, "full_name" | "avatar_url">>,
): Promise<User | null> {
  const fields = []
  const values = []
  let paramIndex = 1

  if (updates.full_name !== undefined) {
    fields.push(`full_name = $${paramIndex++}`)
    values.push(updates.full_name)
  }

  if (updates.avatar_url !== undefined) {
    fields.push(`avatar_url = $${paramIndex++}`)
    values.push(updates.avatar_url)
  }

  if (fields.length === 0) {
    return getUserById(userId)
  }

  fields.push(`updated_at = NOW()`)
  values.push(userId)

  const result = await db.query<User>(
    `UPDATE users SET ${fields.join(", ")} WHERE id = $${paramIndex}
     RETURNING id, email, full_name, avatar_url, email_verified, created_at, updated_at`,
    values,
  )

  return result.rows[0] || null
}

// Change password
export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await db.query<{ password_hash: string }>(`SELECT password_hash FROM users WHERE id = $1`, [userId])

    if (result.rows.length === 0) {
      return { success: false, error: "User not found" }
    }

    // Verify current password
    const valid = await verifyPassword(currentPassword, result.rows[0].password_hash)
    if (!valid) {
      return { success: false, error: "Current password is incorrect" }
    }

    // Hash new password
    const newHash = await hashPassword(newPassword)

    // Update password
    await db.query(`UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`, [newHash, userId])

    return { success: true }
  } catch (error) {
    console.error("[Auth] Change password error:", error)
    return { success: false, error: "Failed to change password" }
  }
}

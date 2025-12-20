/**
 * Authentication Type Definitions
 * Local type definitions for the PostgreSQL-based authentication system
 */

// User type for local authentication
export interface User {
  id: string
  email?: string
  user_metadata?: {
    full_name?: string
    avatar_url?: string
    [key: string]: unknown
  }
  app_metadata?: {
    [key: string]: unknown
  }
  aud?: string
  created_at?: string
  updated_at?: string
  role?: string
}

// Auth session type
export interface Session {
  access_token: string
  refresh_token?: string
  token_type?: string
  expires_in?: number
  expires_at?: number
  user: User
}

// Auth error type
export interface AuthError {
  message: string
  status?: number
}

// Backward compatibility - re-export from supabase-compat for existing code
export type { User as SupabaseUser, Session as SupabaseSession } from "./supabase-compat"

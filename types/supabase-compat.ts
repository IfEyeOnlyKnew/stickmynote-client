/**
 * Compatibility Type Definitions
 * Provides types for the database adapter query builder API
 */

// User type compatible with local auth
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

// Realtime types - stub implementations since we're not using Supabase realtime
export interface RealtimeChannelOptions {
  event?: string
  schema?: string
  table?: string
  filter?: string
}

export interface RealtimeChannel {
  on(event: string, callback: (payload: any) => void): RealtimeChannel
  on(event: string, opts: RealtimeChannelOptions, callback: (payload: any) => void): RealtimeChannel
  subscribe(callback?: (status: string) => void): RealtimeChannel
  unsubscribe(): Promise<void>
  send(payload: { type: string; event: string; payload: unknown }): Promise<void>
  track(payload: unknown): Promise<void>
  untrack(): Promise<void>
  presenceState(): Record<string, unknown[]>
}

export interface RealtimePostgresChangesPayload<T = unknown> {
  schema: string
  table: string
  commit_timestamp: string
  eventType: 'INSERT' | 'UPDATE' | 'DELETE'
  new: T
  old: T
  errors: string[] | null
}

// Presence types
export interface RealtimePresenceState<T = unknown> {
  [key: string]: T[]
}

export interface RealtimePresenceJoinPayload<T = unknown> {
  key: string
  currentPresences: T[]
  newPresences: T[]
}

export interface RealtimePresenceLeavePayload<T = unknown> {
  key: string
  currentPresences: T[]
  leftPresences: T[]
}

// Database query builder types (stub)
export interface PostgrestFilterBuilder<T = unknown> {
  eq(column: string, value: unknown): PostgrestFilterBuilder<T>
  neq(column: string, value: unknown): PostgrestFilterBuilder<T>
  gt(column: string, value: unknown): PostgrestFilterBuilder<T>
  gte(column: string, value: unknown): PostgrestFilterBuilder<T>
  lt(column: string, value: unknown): PostgrestFilterBuilder<T>
  lte(column: string, value: unknown): PostgrestFilterBuilder<T>
  like(column: string, value: string): PostgrestFilterBuilder<T>
  ilike(column: string, value: string): PostgrestFilterBuilder<T>
  is(column: string, value: unknown): PostgrestFilterBuilder<T>
  in(column: string, values: unknown[]): PostgrestFilterBuilder<T>
  contains(column: string, value: unknown): PostgrestFilterBuilder<T>
  containedBy(column: string, value: unknown): PostgrestFilterBuilder<T>
  order(column: string, options?: { ascending?: boolean }): PostgrestFilterBuilder<T>
  limit(count: number): PostgrestFilterBuilder<T>
  range(from: number, to: number): PostgrestFilterBuilder<T>
  single(): Promise<{ data: T | null; error: Error | null }>
  maybeSingle(): Promise<{ data: T | null; error: Error | null }>
  select(columns?: string): PostgrestFilterBuilder<T>
  insert(values: Partial<T> | Partial<T>[]): PostgrestFilterBuilder<T>
  update(values: Partial<T>): PostgrestFilterBuilder<T>
  delete(): PostgrestFilterBuilder<T>
  upsert(values: Partial<T> | Partial<T>[]): PostgrestFilterBuilder<T>
  then<TResult>(onfulfilled?: (value: { data: T[] | null; error: Error | null }) => TResult): Promise<TResult>
}

// SupabaseClient stub type - points to local database functions
export interface SupabaseClient {
  auth: {
    getUser(): Promise<{ data: { user: User | null }; error: Error | null }>
    getSession(): Promise<{ data: { session: Session | null }; error: Error | null }>
    signInWithPassword(credentials: { email: string; password: string }): Promise<{ data: { user: User | null; session: Session | null }; error: Error | null }>
    signOut(): Promise<{ error: Error | null }>
    onAuthStateChange(callback: (event: string, session: Session | null) => void): { data: { subscription: { unsubscribe: () => void } } }
  }
  from<T = unknown>(table: string): PostgrestFilterBuilder<T>
  channel(name: string): RealtimeChannel
  removeChannel(channel: RealtimeChannel): Promise<void>
  storage: {
    from(bucket: string): {
      upload(path: string, file: File | Blob): Promise<{ data: { path: string } | null; error: Error | null }>
      download(path: string): Promise<{ data: Blob | null; error: Error | null }>
      getPublicUrl(path: string): { data: { publicUrl: string } }
      remove(paths: string[]): Promise<{ data: unknown[] | null; error: Error | null }>
    }
  }
}

// Auth helpers types
export interface AuthError {
  message: string
  status?: number
}

// Export all types
export type {
  User as SupabaseUser,
  Session as SupabaseSession,
}

# Pad Invitation Authentication Flow

## Problem Summary
User `chrisdoran63@outlook.com` was invited to pad `6caaeea3-10fc-4e00-8d06-fa5f38a7a4ac` but cannot see it when accessing the site.

## Root Cause
**The user is not logged in.** Debug logs show:
- `"hasAuth":false`
- `"No authenticated user (public page)"`

## Database Status
The invitation was created successfully:
\`\`\`json
{
  "pad_id": "6caaeea3-10fc-4e00-8d06-fa5f38a7a4ac",
  "user_id": "2448e6ec-c1c8-4b68-9325-a6d194d5cf27",
  "role": "edit",
  "accepted": false,
  "invited_at": "2025-11-18 15:52:24.074+00"
}
\`\`\`

## Why User Can't See the Pad

### 1. Authentication Required
The `fetchUserPads` function uses Supabase RLS (Row Level Security) which requires authentication:

\`\`\`typescript
const { data: { user } } = await supabase.auth.getUser()
\`\`\`

When not logged in, `user` is `null` and `auth.uid()` returns `null`.

### 2. RLS Policy
The `pad_members_select_policy` allows users to see only their own memberships:

\`\`\`sql
CREATE POLICY "pad_members_select_policy" ON pad_members
  FOR SELECT
  USING (user_id = auth.uid());
\`\`\`

When `auth.uid()` is `null` (not authenticated), the query returns no results.

### 3. Page Redirect
The `/mypads` page redirects unauthenticated users to login:

\`\`\`typescript
if (error || !user) {
  redirect("/auth/login")
}
\`\`\`

## Correct Flow for Invited Users

### Scenario 1: User Already Has Account & Is Logged In
1. User receives invitation email
2. **User is already logged in** to stickmynote.com
3. User visits `/mypads` → sees the invited pad immediately (with `accepted: false`)
4. User clicks on the pad → auto-acceptance happens
5. The `accepted` field updates to `true`

### Scenario 2: User Has Account But NOT Logged In (Current Issue)
1. User receives invitation email
2. **User is NOT logged in**
3. User visits stickmynote.com or `/mypads`
4. System redirects to `/auth/login`
5. **User must log in with their existing account**
6. After login, system redirects to `/mypads`
7. User sees the invited pad in their list
8. User clicks on pad → auto-acceptance happens

### Scenario 3: User Clicks Email Link Directly
1. User receives invitation email with link: `https://www.stickmynote.com/pads/6caaeea3-10fc-4e00-8d06-fa5f38a7a4ac?redirect=/pads/6caaeea3-10fc-4e00-8d06-fa5f38a7a4ac`
2. If not logged in, middleware redirects to: `/auth/login?redirect=/pads/6caaeea3-10fc-4e00-8d06-fa5f38a7a4ac`
3. User logs in
4. System redirects to the pad URL
5. Pad page auto-accepts the invitation
6. User has access to the pad

## Auto-Acceptance Mechanism

When a user with a `paks_pad_members` record (where `accepted=false`) visits the pad, the system automatically accepts it:

\`\`\`typescript
// In app/pads/[padId]/page.tsx
if (pendingInvite) {
  await supabase
    .from("paks_pad_members")
    .update({ accepted: true })
    .eq("user_id", user.id)
    .eq("pad_id", params.padId)
}
\`\`\`

## Solution for Current Issue

**The user needs to log in** at https://www.stickmynote.com/auth/login

Once logged in:
1. Navigate to `/mypads` - the pad will appear in their list
2. Or click the email invitation link - will be redirected to login, then to the pad
3. The system will auto-accept the invitation upon first visit

## Technical Notes

- **Database record exists**: ✅ Correct
- **RLS policies work correctly**: ✅ Secure (require authentication)
- **Auto-acceptance implemented**: ✅ Working
- **Issue**: ❌ User not authenticated

## Troubleshooting

### User says "I'm logged in but still don't see the pad"
1. Check cookies: `sb-<project>-auth-token` should exist
2. Verify session: Check `/api/auth/user` or browser dev tools
3. Check browser console for `[v0] UserContext` logs
4. Try logging out and back in

### User can't log in
1. Verify email is correct: `chrisdoran63@outlook.com`
2. Check if account exists in `auth.users` and `public.users`
3. Try password reset if forgotten

### Pad still shows `accepted: false` after visiting
1. Check if auto-acceptance code ran (server logs)
2. Verify RLS policies allow UPDATE on `paks_pad_members`
3. Check if user has correct `user_id` in session

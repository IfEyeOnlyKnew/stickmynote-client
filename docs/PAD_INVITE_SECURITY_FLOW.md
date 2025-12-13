# Pad Invitation Security Flow

## Overview

The Stick My Note application implements a secure two-path invitation system for pads that handles both existing users and users who haven't signed up yet.

## Database Schema

### Core Tables

**pads**
- `id`: UUID (primary key)
- `owner_id`: UUID (references users)
- `name`: text
- `description`: text
- RLS Enabled: Yes

**pad_members**
- `id`: UUID (primary key)
- `pad_id`: UUID (references pads)
- `user_id`: UUID (references users)
- `role`: text ('admin', 'editor', 'viewer')
- `accepted`: boolean (invitation acceptance status)
- `invited_by`: UUID (references users)
- `invited_at`: timestamp
- `joined_at`: timestamp
- RLS Enabled: Yes

**pad_pending_invites**
- `id`: UUID (primary key)
- `pad_id`: UUID (references pads)
- `email`: text (invited user's email)
- `role`: text ('admin', 'editor', 'viewer')
- `invited_by`: UUID (references users)
- `invited_at`: timestamp
- RLS Enabled: Yes

## Invitation Flow

### Scenario 1: Inviting an Existing User

When an existing user (someone already in the `users` table) is invited:

1. **Invitation Creation** (`/api/pad-invites`)
   - Admin/Owner sends invitation with email
   - System looks up user by email in `users` table
   - If user exists, creates record in `pad_members` with `accepted = false`
   - Sends invitation email with pad link

2. **Security Checks**
   - Verify inviter is owner or admin of the pad
   - Check if user is already a member (prevent duplicates)
   - Validate role is one of: admin, editor, viewer

3. **User Acceptance - AUTO-ACCEPTANCE**
   - User clicks link in email → lands on `/pads/[padId]`
   - System automatically checks for unaccepted memberships
   - Updates `pad_members.accepted = true` and sets `joined_at`
   - User immediately gains access based on their role

4. **Permissions**
   - After auto-acceptance, permissions match their assigned role
   - No manual acceptance UI needed - seamless experience

### Scenario 2: Inviting a Non-Existent User

When someone who hasn't signed up yet is invited:

1. **Invitation Creation** (`/api/pad-invites`)
   - Admin/Owner sends invitation with email
   - System looks up user by email → not found
   - Creates record in `pad_pending_invites` table
   - Sends invitation email with signup link

2. **Security Checks**
   - Same verification as Scenario 1
   - Email stored in pending invites (separate from pad_members)
   - Invitation remains pending until user creates account

3. **User Signup & Auto-Processing**
   - User receives email, clicks "Sign Up" link
   - User completes Supabase authentication
   - When user visits `/pads/[padId]`:
     - System queries `pad_pending_invites` by email
     - For each pending invite:
       - Creates `pad_members` record with `accepted = true`
       - Sets `joined_at` to current time
       - Deletes the pending invite record
   - User is automatically added to the pad they were invited to

4. **Auto-Acceptance Logic** (`/pads/[padId]/page.tsx`)
\`\`\`typescript
// Check for pending invites (new users)
const pendingInvites = await supabase
  .from("paks_pad_pending_invites")
  .select("*")
  .eq("pad_id", padId)
  .eq("email", userEmail)

for (const invite of pendingInvites) {
  await supabase.from("paks_pad_members").insert({
    pad_id: invite.pad_id,
    user_id: user.id,
    role: invite.role,
    accepted: true,
    joined_at: new Date().toISOString(),
  })
  await supabase.from("paks_pad_pending_invites").delete().eq("id", invite.id)
}

// Check for unaccepted memberships (existing users)
const unacceptedMembers = await supabase
  .from("paks_pad_members")
  .select("*")
  .eq("pad_id", padId)
  .eq("user_id", user.id)
  .eq("accepted", false)

for (const member of unacceptedMembers) {
  await supabase.from("paks_pad_members")
    .update({
      accepted: true,
      joined_at: new Date().toISOString(),
    })
    .eq("id", member.id)
}
\`\`\`

## Security Implementation

### Row Level Security (RLS) Policies

**pad_members**
\`\`\`sql
-- SELECT: Users can see their own memberships
POLICY "pad_members_select_policy"
  USING (user_id = auth.uid())

-- INSERT: Owner or Admin can add members
POLICY "pad_members_insert_policy"
  WITH CHECK (
    EXISTS (SELECT 1 FROM pads WHERE id = pad_id AND owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM pad_members WHERE pad_id = pad_id AND user_id = auth.uid() AND role = 'admin' AND accepted = true)
  )

-- UPDATE: Owner or Admin can update memberships
POLICY "pad_members_update_policy"
  USING (same as INSERT)

-- DELETE: Owner or Admin can remove members
POLICY "pad_members_delete_policy"
  USING (same as INSERT)
\`\`\`

**pad_pending_invites**
\`\`\`sql
-- SELECT: Owner and admins can see pending invites
POLICY "pad_pending_invites_select"
  USING (
    EXISTS (SELECT 1 FROM pads WHERE id = pad_id AND owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM pad_members WHERE pad_id = pad_id AND user_id = auth.uid() AND role = 'admin')
  )

-- INSERT: Owner and admins can create invites
POLICY "pad_pending_invites_insert"
  WITH CHECK (same as SELECT)

-- DELETE: Owner and admins can delete invites
POLICY "pad_pending_invites_delete"
  USING (same as SELECT)
\`\`\`

### Permission Levels

**Owner (Implicit Admin)**
- Full control over pad
- Can add/remove members
- Can delete pad
- Can change pad settings
- Automatically has admin privileges

**Admin**
- Can manage members (add, remove, change roles)
- Full access to all sticks
- Can delete sticks created by others
- Cannot delete the pad itself

**Editor**
- Can create and edit sticks
- Can add replies and comments
- Cannot delete others' sticks
- Cannot manage members

**Viewer**
- Read-only access
- Can view sticks and replies
- Cannot create or edit content
- Cannot manage members

## Best Practices

### When Inviting Users

1. **Always validate email format** before sending invites
2. **Check for existing memberships** to avoid duplicate invitations
3. **Use appropriate role** based on user's responsibilities
4. **Send clear invitation emails** with:
   - Who invited them
   - Pad name and description
   - Their assigned role and permissions
   - Clear call-to-action button

### Security Considerations

1. **Email Verification Required**
   - Only send invites to verified emails
   - Require email confirmation before processing invites

2. **Rate Limiting**
   - Limit number of invites per pad per hour
   - Prevent spam and abuse

3. **Invite Expiration** (Future Enhancement)
   - Consider adding expiration dates to pending invites
   - Clean up old, unused invitations

4. **Role Changes**
   - Log all role changes for audit trail
   - Notify users when their role changes

5. **Service Role Key Usage**
   - Use `SUPABASE_SERVICE_ROLE_KEY` to bypass RLS when:
     - Processing pending invites in auth callback
     - System needs to create memberships on behalf of users
   - Never expose service role key to client

## Error Handling

### Common Errors

1. **User Already Member**
   - Check before invite creation
   - Return friendly error message
   - Suggest viewing existing members

2. **Invalid Email**
   - Validate email format
   - Check if email is disposable/temporary
   - Provide clear validation error

3. **Permission Denied**
   - Verify user has admin/owner status
   - Return 403 with explanation
   - Don't leak information about pad structure

4. **Invite Not Found**
   - Handle gracefully in callback
   - Don't fail authentication if invite processing fails
   - Log for debugging but allow user to proceed

## Testing Checklist

- [ ] Invite existing user → they receive email
- [ ] Existing user accepts invite → gains access
- [ ] Invite non-existent user → they receive email
- [ ] New user signs up → automatically added to pad
- [ ] Cannot invite same user twice
- [ ] Only admin/owner can send invites
- [ ] Viewer cannot send invites
- [ ] Editor cannot send invites
- [ ] RLS prevents unauthorized access
- [ ] Pending invites cleaned up after processing
- [ ] Email notifications sent correctly
- [ ] Role permissions enforced properly

## API Endpoints

**POST /api/pad-invites**
- Create new invitation
- Body: `{ padId, role, userIds?, emails? }`
- Returns: Success/failure summary

**POST /api/pads/[padId]/process-invites**
- Process pending invites for logged-in user
- Auto-called when user visits pad after signup
- Returns: Processing status

**GET /auth/callback**
- Handles Supabase authentication callback
- Auto-processes all pending invites for user's email
- Redirects to appropriate page after processing

## Troubleshooting

### User doesn't receive email
- Check RESEND_API_KEY and RESEND_FROM_EMAIL environment variables in the Vars section
- Verify email is not in spam folder
- Check email sending logs in console (look for [v0] prefixed messages)
- Verify Resend API is working and has available quota
- Check that NEXT_PUBLIC_SITE_URL is correctly set

### User can't access pad after accepting
- Verify `accepted` field is set to `true` in pad_members table
- Check RLS policies are correctly configured
- Ensure user is logged in with correct account
- Verify pad still exists and user hasn't been removed
- Check browser console for [v0] auto-acceptance logs

### Invitation already sent error
- Check pad_members for existing membership
- Check pad_pending_invites for existing pending invite
- User may need to accept existing invitation first
- Clear duplicate entries if they exist

### Email says sent but doesn't arrive
- Verify RESEND_API_KEY is valid and not expired
- Check Resend dashboard for delivery status
- Verify RESEND_FROM_EMAIL domain is verified in Resend
- Check email sending logs for API errors
- Test with different email addresses to rule out provider issues

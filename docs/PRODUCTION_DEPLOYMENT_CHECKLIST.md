# Production Deployment Checklist for Pad Invitations

## Issue Summary
User `chrisdoran63@outlook.com` was invited to pad `6caaeea3-10fc-4e00-8d06-fa5f38a7a4ac` but cannot see it in production.

## Root Cause
The production site is running old code that filtered `pad_members` by `accepted=true`, preventing users from seeing their invited pads until they visited the specific pad URL.

## Changes Made in v0 (Not Yet Deployed to Production)

### 1. Removed `accepted=true` Filter
**File**: `lib/data/pads-data.ts`
- Removed `.eq("accepted", true)` from the member pads query
- Users now see ALL pads they've been invited to, regardless of accepted status

### 2. Added Role Mapping
**File**: `lib/data/pads-data.ts`
- Added `mapRoleFromDatabase()` function to convert database values ("edit", "view") to app values ("editor", "viewer")
- This handles the mismatch between database constraints and application code

### 3. Fixed Service Role Client Usage
**File**: `app/api/pad-invites/route.ts`
- Uses service role client to bypass RLS when looking up users by email
- Uses service role client to insert pad_members and pad_pending_invites records

### 4. Enhanced Debugging
**Files**: `lib/data/pads-data.ts`, `app/mypads/page.tsx`
- Added comprehensive logging to track authentication, queries, and results

## Deployment Steps

### Step 1: Deploy Code to Production
1. Push the latest code from this v0 session to GitHub
2. Vercel will automatically deploy the changes to production
3. Wait for deployment to complete

### Step 2: Verify User Can See Invited Pad
1. Have user `chrisdoran63@outlook.com` log into https://www.stickmynote.com
2. Navigate to /mypads
3. They should now see pad `6caaeea3-10fc-4e00-8d06-fa5f38a7a4ac` in their list

### Step 3: Check Browser Console Logs
If the pad still doesn't appear, check browser console for these logs:
- `[v0] MyPadsPage - Authentication check` - Should show user ID and email
- `[v0] fetchUserPads - Member pads query` - Should show pad in the results
- `[v0] fetchUserPads - Final result` - Should show total pad count

## Expected Database State (Already Correct)

The database already has the correct entry in `pad_members`:
\`\`\`json
{
  "id": "ad262eba-8cef-4e50-82f1-3494892f76a9",
  "pad_id": "6caaeea3-10fc-4e00-8d06-fa5f38a7a4ac",
  "user_id": "2448e6ec-c1c8-4b68-9325-a6d194d5cf27",
  "role": "edit",
  "accepted": false
}
\`\`\`

This is correct. Once the new code is deployed, the query will return this record and display the pad.

## Troubleshooting

### If Pad Still Doesn't Appear After Deployment

1. **Check Authentication**: 
   - Open browser console at https://www.stickmynote.com/mypads
   - Look for log: `[v0] MyPadsPage - Authentication check`
   - Verify `userId` matches `2448e6ec-c1c8-4b68-9325-a6d194d5cf27`

2. **Check Query Results**:
   - Look for log: `[v0] fetchUserPads - Member pads query`
   - Should show `count: 1` and include the pad data

3. **Check RLS Policies**:
   - The `pad_members_self_select` policy should allow users to see their own records
   - Run this query in Supabase SQL editor as the user:
     \`\`\`sql
     SELECT * FROM pad_members WHERE user_id = '2448e6ec-c1c8-4b68-9325-a6d194d5cf27';
     \`\`\`

4. **Clear Browser Cache**:
   - Hard refresh the page (Ctrl+Shift+R or Cmd+Shift+R)
   - Clear cookies and local storage
   - Try in incognito/private browsing mode

## Summary

The code is now correct in v0. The issue is that **production needs to be updated with the latest code**. Once deployed, the user will see all pads they've been invited to in /mypads, regardless of whether they've visited the pad URL or clicked the email link.

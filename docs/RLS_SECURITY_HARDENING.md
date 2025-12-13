# Row-Level Security (RLS) Hardening Guide

## Overview

This document describes the comprehensive Row-Level Security (RLS) implementation for Stick My Note, including hardening strategies, test coverage, and security best practices.

## Security Model

### Core Principles

1. **Principle of Least Privilege**: Users can only access data they own or have been explicitly granted access to
2. **Defense in Depth**: Multiple layers of security (RLS policies + application logic + API validation)
3. **Zero Trust**: All requests are validated, even from authenticated users
4. **Explicit Permissions**: Access must be explicitly granted, never assumed

### User Roles & Permissions

#### Social Pads Hierarchy
- **Owner**: Full control (create, read, update, delete pad and all contents)
- **Admin**: Can manage members, create/edit/delete sticks, but cannot delete the pad
- **Member**: Can view and create sticks, edit own sticks
- **Viewer**: Read-only access (for public pads)

#### Personal Notes
- **Owner**: Full control over their own notes
- **Shared**: Read-only access for authenticated users when `is_shared = true`

## Critical Security Gaps Fixed

### 1. Tables Without RLS (CRITICAL)

**Before**: `calstick_tasks` table had RLS disabled, allowing any authenticated user to access all tasks.

**After**: Enabled RLS with owner-only policies:
\`\`\`sql
ALTER TABLE calstick_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "calstick_tasks_select_own" ON calstick_tasks
  FOR SELECT USING (user_id = auth.uid() OR stick_owner_id = auth.uid());
\`\`\`

### 2. Weak Social Pad Policies

**Before**: Policies allowed members to potentially escalate privileges or access pads they shouldn't.

**After**: Tightened policies with explicit role checks:
- Public pads visible to all authenticated users
- Private pads only visible to owner and accepted members
- Only owner can delete pads
- Only owner and admins can update pad settings

### 3. Missing Cascade Protection

**Before**: Deleting a pad might leave orphaned sticks and members.

**After**: All foreign keys use `ON DELETE CASCADE` to ensure data integrity.

### 4. Anonymous User Access

**Before**: Anonymous users had table-level SELECT permissions.

**After**: Revoked ALL permissions from `anon` role:
\`\`\`sql
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
GRANT USAGE ON SCHEMA public TO anon;
\`\`\`

### 5. User Profile Security

**Before**: Users could potentially modify other users' profiles or change their own user ID.

**After**: Strict policies prevent ID changes and cross-user modifications:
\`\`\`sql
CREATE POLICY "users_update_hardened" ON users
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND id = (SELECT id FROM users WHERE id = auth.uid())
  );
\`\`\`

## RLS Policy Structure

### Policy Naming Convention

All hardened policies follow this pattern:
- `{table}_{operation}_hardened`
- Example: `social_pads_select_hardened`, `notes_update_hardened`

### Policy Components

Each table has four policies (CRUD):
1. **SELECT**: Who can read data
2. **INSERT**: Who can create new records
3. **UPDATE**: Who can modify existing records
4. **DELETE**: Who can remove records

### Example: Social Pads

\`\`\`sql
-- SELECT: Public pads OR owner OR accepted member
CREATE POLICY "social_pads_select_hardened" ON social_pads
  FOR SELECT
  USING (
    is_public = true
    OR owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM social_pad_members spm
      WHERE spm.social_pad_id = social_pads.id
        AND spm.user_id = auth.uid()
        AND spm.accepted = true
    )
  );

-- INSERT: Only authenticated users, must be owner
CREATE POLICY "social_pads_insert_hardened" ON social_pads
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND owner_id = auth.uid()
  );

-- UPDATE: Only owner or admins
CREATE POLICY "social_pads_update_hardened" ON social_pads
  FOR UPDATE
  USING (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM social_pad_members spm
      WHERE spm.social_pad_id = social_pads.id
        AND spm.user_id = auth.uid()
        AND spm.admin_level = 'admin'
        AND spm.accepted = true
    )
  );

-- DELETE: Only owner
CREATE POLICY "social_pads_delete_hardened" ON social_pads
  FOR DELETE
  USING (owner_id = auth.uid());
\`\`\`

## Security Helper Functions

### `can_access_social_pad(pad_id, user_id)`

Safely checks if a user can access a social pad.

\`\`\`sql
CREATE OR REPLACE FUNCTION can_access_social_pad(pad_id UUID, user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM social_pads sp
    WHERE sp.id = pad_id
      AND (
        sp.is_public = true
        OR sp.owner_id = user_id
        OR EXISTS (
          SELECT 1 FROM social_pad_members spm
          WHERE spm.social_pad_id = sp.id
            AND spm.user_id = user_id
            AND spm.accepted = true
        )
      )
  );
END;
$$;
\`\`\`

### `is_social_pad_admin(pad_id, user_id)`

Checks if a user has admin privileges on a pad.

\`\`\`sql
CREATE OR REPLACE FUNCTION is_social_pad_admin(pad_id UUID, user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM social_pads sp
    WHERE sp.id = pad_id
      AND (
        sp.owner_id = user_id
        OR EXISTS (
          SELECT 1 FROM social_pad_members spm
          WHERE spm.social_pad_id = sp.id
            AND spm.user_id = user_id
            AND spm.admin_level = 'admin'
            AND spm.accepted = true
        )
      )
  );
END;
$$;
\`\`\`

## Performance Optimization

### Indexes for RLS Policies

All RLS policies are backed by appropriate indexes to prevent performance degradation:

\`\`\`sql
-- Speed up membership checks
CREATE INDEX idx_social_pad_members_lookup 
  ON social_pad_members(social_pad_id, user_id, accepted);

-- Speed up owner checks
CREATE INDEX idx_social_pads_owner 
  ON social_pads(owner_id);

-- Speed up public pad queries
CREATE INDEX idx_social_pads_public 
  ON social_pads(is_public) WHERE is_public = true;

-- Speed up stick queries
CREATE INDEX idx_social_sticks_pad_user 
  ON social_sticks(social_pad_id, user_id);

-- Speed up note queries
CREATE INDEX idx_notes_user_shared 
  ON notes(user_id, is_shared);
\`\`\`

## Testing Unauthorized Access

### Running Tests

\`\`\`bash
# Run all RLS security tests
npm run test:rls

# Or directly with tsx
npx tsx scripts/test-rls-unauthorized-access.ts
\`\`\`

### Test Coverage

The test suite covers 18 unauthorized access patterns:

#### Notes Security (3 tests)
- ✅ User cannot read other users' private notes
- ✅ User cannot update other users' notes
- ✅ User cannot delete other users' notes

#### Social Pads Security (3 tests)
- ✅ User cannot read other users' private pads
- ✅ User cannot update other users' pads
- ✅ User cannot delete other users' pads

#### Social Sticks Security (4 tests)
- ✅ User cannot read sticks in private pads
- ✅ User cannot create sticks in other users' pads
- ✅ User cannot update other users' sticks
- ✅ User cannot delete other users' sticks

#### Member Management Security (1 test)
- ✅ User cannot add themselves to private pads

#### Anonymous User Security (3 tests)
- ✅ Anonymous users cannot read private notes
- ✅ Anonymous users cannot read private pads
- ✅ Anonymous users cannot create any content

#### User Profile Security (2 tests)
- ✅ User cannot update other users' profiles
- ✅ User cannot change their own user ID

### Test Results

All tests should pass with output like:
\`\`\`
✅ User2 cannot read User1's private notes
✅ User2 cannot update User1's notes
✅ User2 cannot delete User1's notes
...
📊 Test Summary
==================================================
Total Tests: 18
✅ Passed: 18
❌ Failed: 0
\`\`\`

## Deployment Checklist

### Pre-Deployment

- [ ] Run `npm run test:rls` to verify all security tests pass
- [ ] Review all RLS policies in Supabase dashboard
- [ ] Verify indexes are created for performance
- [ ] Test with real user accounts in staging environment
- [ ] Review audit logs for any suspicious access patterns

### Deployment Steps

1. **Backup Database**
   \`\`\`bash
   # Create a backup before applying changes
   pg_dump -h your-db-host -U postgres -d your-db > backup.sql
   \`\`\`

2. **Apply RLS Hardening**
   \`\`\`sql
   -- Run in Supabase SQL Editor
   -- File: scripts/rls-hardening-comprehensive.sql
   \`\`\`

3. **Verify Policies**
   \`\`\`sql
   -- Check all tables have RLS enabled
   SELECT tablename, rowsecurity 
   FROM pg_tables 
   WHERE schemaname = 'public' 
   AND rowsecurity = false;
   
   -- Should return 0 rows for sensitive tables
   \`\`\`

4. **Run Security Tests**
   \`\`\`bash
   npm run test:rls
   \`\`\`

5. **Monitor Application**
   - Check error logs for RLS-related errors
   - Monitor query performance
   - Review user reports of access issues

### Post-Deployment

- [ ] Monitor error rates in production
- [ ] Review slow query logs
- [ ] Verify no legitimate users are blocked
- [ ] Document any issues and resolutions

## Common Issues & Solutions

### Issue: "new row violates row-level security policy"

**Cause**: User trying to insert data they don't have permission for.

**Solution**: Ensure `user_id` or `owner_id` is set to `auth.uid()` in INSERT operations.

\`\`\`typescript
// ❌ Wrong
await supabase.from('notes').insert({ content: 'test' })

// ✅ Correct
await supabase.from('notes').insert({ 
  content: 'test',
  user_id: user.id // Must match auth.uid()
})
\`\`\`

### Issue: "permission denied for table"

**Cause**: Anonymous user trying to access protected table.

**Solution**: Ensure user is authenticated before making requests.

\`\`\`typescript
// Check authentication first
const { data: { user } } = await supabase.auth.getUser()
if (!user) {
  throw new Error('Must be authenticated')
}
\`\`\`

### Issue: Slow queries after RLS implementation

**Cause**: Missing indexes on columns used in RLS policies.

**Solution**: Add indexes as specified in the hardening script.

\`\`\`sql
CREATE INDEX idx_social_pad_members_lookup 
  ON social_pad_members(social_pad_id, user_id, accepted);
\`\`\`

## Best Practices

### 1. Always Use Parameterized Queries

\`\`\`typescript
// ✅ Good - RLS policies apply
const { data } = await supabase
  .from('notes')
  .select('*')
  .eq('user_id', user.id)

// ❌ Bad - Bypasses RLS if using service role
const { data } = await supabaseAdmin
  .from('notes')
  .select('*')
\`\`\`

### 2. Never Use Service Role Client-Side

\`\`\`typescript
// ❌ NEVER expose service role key
const supabase = createClient(url, SERVICE_ROLE_KEY)

// ✅ Always use anon key client-side
const supabase = createClient(url, ANON_KEY)
\`\`\`

### 3. Validate Permissions in Application Layer

\`\`\`typescript
// Defense in depth - check permissions even with RLS
async function updatePad(padId: string, updates: any) {
  const canUpdate = await checkPadPermission(padId, 'update')
  if (!canUpdate) {
    throw new Error('Unauthorized')
  }
  
  // RLS will also enforce this, but application check provides better UX
  return await supabase
    .from('social_pads')
    .update(updates)
    .eq('id', padId)
}
\`\`\`

### 4. Test Edge Cases

Always test:
- Unauthenticated access
- Cross-user access attempts
- Privilege escalation attempts
- Deleted user scenarios
- Concurrent access patterns

## Monitoring & Auditing

### Enable Audit Logging

\`\`\`sql
-- Uncomment audit triggers in production-monitoring.sql
CREATE TRIGGER notes_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON notes
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();
\`\`\`

### Query Audit Logs

\`\`\`sql
-- Recent unauthorized access attempts
SELECT 
  user_id,
  table_name,
  operation,
  created_at
FROM audit_logs
WHERE operation = 'DENIED'
ORDER BY created_at DESC
LIMIT 100;
\`\`\`

### Monitor RLS Performance

\`\`\`sql
-- Slow queries with RLS
SELECT 
  query,
  mean_exec_time,
  calls
FROM pg_stat_statements
WHERE query LIKE '%USING%'
ORDER BY mean_exec_time DESC
LIMIT 20;
\`\`\`

## Additional Resources

- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL RLS Policies](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [OWASP Access Control Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Access_Control_Cheat_Sheet.html)

## Support

For security issues or questions:
- Email: security@stickmynote.com
- Internal: #security-team Slack channel
- Emergency: Page on-call security engineer

---

**Last Updated**: 2025-01-06
**Version**: 1.0.0
**Reviewed By**: Security Team

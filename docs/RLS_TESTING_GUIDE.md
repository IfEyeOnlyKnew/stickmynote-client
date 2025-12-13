# RLS Testing Guide

## Quick Start

\`\`\`bash
# Run all RLS security tests
npm run test:rls

# Run with verbose output
npm run test:rls -- --verbose
\`\`\`

## Test Structure

### Test Setup

Each test run creates two temporary users:
- `test-user-1@example.com` (owns test data)
- `test-user-2@example.com` (attempts unauthorized access)

Test data includes:
- Private note
- Private social pad
- Private stick in the pad

### Test Categories

#### 1. Note Security Tests
Verifies that users cannot access other users' private notes.

\`\`\`typescript
// Test: User2 cannot read User1's private notes
const { data, error } = await user2Client
  .from('notes')
  .select('*')
  .eq('id', testData.note.id)
  .single()

// Expected: data === null && error !== null
\`\`\`

#### 2. Social Pad Security Tests
Verifies pad-level access control.

\`\`\`typescript
// Test: User2 cannot read User1's private pad
const { data, error } = await user2Client
  .from('social_pads')
  .select('*')
  .eq('id', testData.pad.id)
  .single()

// Expected: data === null && error !== null
\`\`\`

#### 3. Social Stick Security Tests
Verifies stick-level access control and inheritance from pads.

\`\`\`typescript
// Test: User2 cannot create stick in User1's pad
const { error } = await user2Client
  .from('social_sticks')
  .insert({
    social_pad_id: testData.pad.id,
    user_id: testData.user2.id,
    topic: 'Unauthorized Stick',
    content: 'Should not be created',
    color: '#red'
  })

// Expected: error !== null
\`\`\`

#### 4. Member Management Tests
Verifies users cannot grant themselves unauthorized access.

\`\`\`typescript
// Test: User2 cannot add themselves to User1's pad
const { error } = await user2Client
  .from('social_pad_members')
  .insert({
    social_pad_id: testData.pad.id,
    user_id: testData.user2.id,
    role: 'admin',
    admin_level: 'admin',
    accepted: true
  })

// Expected: error !== null
\`\`\`

#### 5. Anonymous User Tests
Verifies anonymous users have no access to private data.

\`\`\`typescript
// Test: Anonymous users cannot read private notes
const { data, error } = await anonClient
  .from('notes')
  .select('*')
  .eq('id', testData.note.id)
  .single()

// Expected: data === null && error !== null
\`\`\`

#### 6. User Profile Tests
Verifies profile security and ID immutability.

\`\`\`typescript
// Test: User2 cannot update User1's profile
const { error } = await user2Client
  .from('users')
  .update({ full_name: 'Hacked Name' })
  .eq('id', testData.user1.id)

// Expected: error !== null
\`\`\`

## Writing New Tests

### Test Template

\`\`\`typescript
await runTest('Test description', async () => {
  // Attempt unauthorized operation
  const { data, error } = await unauthorizedClient
    .from('table_name')
    .operation()
  
  // Return true if access was properly denied
  return data === null && error !== null
})
\`\`\`

### Best Practices

1. **Test Both Success and Failure**
   \`\`\`typescript
   // Test unauthorized access is denied
   await runTest('User cannot access private data', async () => {
     const { error } = await user2Client.from('notes').select()
     return error !== null
   })
   
   // Test authorized access works
   await runTest('User can access own data', async () => {
     const { data, error } = await user1Client.from('notes').select()
     return data !== null && error === null
   })
   \`\`\`

2. **Test All CRUD Operations**
   - SELECT (read)
   - INSERT (create)
   - UPDATE (modify)
   - DELETE (remove)

3. **Test Edge Cases**
   - Null values
   - Missing foreign keys
   - Deleted parent records
   - Concurrent operations

4. **Clean Up Test Data**
   \`\`\`typescript
   // Always clean up in finally block
   try {
     await runTests()
   } finally {
     await cleanupTestData()
   }
   \`\`\`

## Continuous Integration

### GitHub Actions

\`\`\`yaml
name: RLS Security Tests

on: [push, pull_request]

jobs:
  test-rls:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run test:rls
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}
\`\`\`

## Troubleshooting

### Tests Failing

1. **Check Environment Variables**
   \`\`\`bash
   echo $NEXT_PUBLIC_SUPABASE_URL
   echo $NEXT_PUBLIC_SUPABASE_ANON_KEY
   echo $SUPABASE_SERVICE_ROLE_KEY
   \`\`\`

2. **Verify RLS Policies Are Applied**
   \`\`\`sql
   SELECT tablename, policyname 
   FROM pg_policies 
   WHERE schemaname = 'public'
   ORDER BY tablename;
   \`\`\`

3. **Check Test User Creation**
   \`\`\`typescript
   // Add debug logging
   console.log('User 1:', user1)
   console.log('User 2:', user2)
   \`\`\`

### Performance Issues

If tests are slow:

1. **Add Indexes**
   \`\`\`sql
   CREATE INDEX idx_test_lookup 
     ON table_name(column_name);
   \`\`\`

2. **Use Transactions**
   \`\`\`typescript
   await supabase.rpc('begin_transaction')
   // Run tests
   await supabase.rpc('rollback_transaction')
   \`\`\`

3. **Parallel Test Execution**
   \`\`\`typescript
   await Promise.all([
     runTest('Test 1', test1),
     runTest('Test 2', test2),
     runTest('Test 3', test3)
   ])
   \`\`\`

## Manual Testing

### Using Supabase Dashboard

1. Go to SQL Editor
2. Run as different users:
   \`\`\`sql
   -- Set session to user 1
   SET LOCAL role TO authenticated;
   SET LOCAL request.jwt.claims TO '{"sub": "user-1-uuid"}';
   
   -- Try to access user 2's data
   SELECT * FROM notes WHERE user_id = 'user-2-uuid';
   -- Should return 0 rows
   \`\`\`

### Using Postman/Insomnia

1. Get user 1's JWT token
2. Try to access user 2's data
3. Verify 403 Forbidden or empty response

\`\`\`bash
curl -X GET \
  'https://your-project.supabase.co/rest/v1/notes?user_id=eq.user-2-uuid' \
  -H 'apikey: YOUR_ANON_KEY' \
  -H 'Authorization: Bearer USER_1_JWT'
\`\`\`

## Reporting Security Issues

If you discover a security vulnerability:

1. **DO NOT** create a public GitHub issue
2. Email security@stickmynote.com with:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

---

**Last Updated**: 2025-01-06

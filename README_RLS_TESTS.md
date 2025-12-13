# RLS Security Testing

This document explains how to run the Row-Level Security (RLS) tests to verify that unauthorized access patterns are properly blocked.

## Overview

The RLS tests verify that:
- Users cannot access other users' private data
- Anonymous users cannot perform unauthorized operations
- Member permissions are properly enforced
- Profile data is protected from unauthorized modifications

## Running the Tests

### Prerequisites

1. Ensure you have the required environment variables set:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`

2. Make sure the RLS hardening SQL script has been executed:
   \`\`\`bash
   # Run this in your Supabase SQL editor
   scripts/rls-hardening-comprehensive.sql
   \`\`\`

### Run All Security Tests

\`\`\`bash
npm run test:security
\`\`\`

Or specifically run the RLS tests:

\`\`\`bash
npm run test:rls
\`\`\`

### What Gets Tested

The test suite covers 17 unauthorized access patterns:

#### 1. Note Security (3 tests)
- ❌ User2 cannot read User1's private notes
- ❌ User2 cannot update User1's notes
- ❌ User2 cannot delete User1's notes

#### 2. Social Pad Security (3 tests)
- ❌ User2 cannot read User1's private pad
- ❌ User2 cannot update User1's pad
- ❌ User2 cannot delete User1's pad

#### 3. Social Stick Security (4 tests)
- ❌ User2 cannot read User1's private stick
- ❌ User2 cannot create stick in User1's pad
- ❌ User2 cannot update User1's stick
- ❌ User2 cannot delete User1's stick

#### 4. Member Manipulation (1 test)
- ❌ User2 cannot add themselves to User1's pad

#### 5. Anonymous User Restrictions (3 tests)
- ❌ Anonymous users cannot read private notes
- ❌ Anonymous users cannot read private pads
- ❌ Anonymous users cannot create notes

#### 6. User Profile Security (2 tests)
- ❌ User2 cannot update User1's profile
- ❌ User2 cannot change their own user ID

### Expected Output

\`\`\`
🔒 RLS Unauthorized Access Pattern Tests

🔧 Setting up test data...

✅ User2 cannot read User1's private notes
✅ User2 cannot update User1's notes
✅ User2 cannot delete User1's notes
✅ User2 cannot read User1's private pad
✅ User2 cannot update User1's pad
✅ User2 cannot delete User1's pad
✅ User2 cannot read User1's private stick
✅ User2 cannot create stick in User1's pad
✅ User2 cannot update User1's stick
✅ User2 cannot delete User1's stick
✅ User2 cannot add themselves to User1's pad
✅ Anonymous users cannot read private notes
✅ Anonymous users cannot read private pads
✅ Anonymous users cannot create notes
✅ User2 cannot update User1's profile
✅ User2 cannot change their own user ID

==================================================
📊 Test Summary
==================================================

Total Tests: 17
✅ Passed: 17
❌ Failed: 0

🧹 Cleaning up test data...

✨ Tests complete!
\`\`\`

### Troubleshooting

#### Test Failures

If tests fail, it indicates a security vulnerability. Common causes:

1. **RLS policies not applied**: Run `scripts/rls-hardening-comprehensive.sql`
2. **Service role key used incorrectly**: Ensure tests use anon key for user operations
3. **Policy logic errors**: Review the specific failing test and corresponding RLS policy

#### Environment Issues

If you get authentication errors:
\`\`\`bash
# Verify your environment variables
echo $NEXT_PUBLIC_SUPABASE_URL
echo $NEXT_PUBLIC_SUPABASE_ANON_KEY
echo $SUPABASE_SERVICE_ROLE_KEY
\`\`\`

#### Database Connection Issues

If tests cannot connect to Supabase:
1. Check your Supabase project is running
2. Verify the URL and keys are correct
3. Ensure your IP is allowed in Supabase settings

## Continuous Integration

Add this to your CI/CD pipeline:

\`\`\`yaml
# .github/workflows/security-tests.yml
name: Security Tests

on: [push, pull_request]

jobs:
  rls-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run test:security
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
\`\`\`

## Security Best Practices

1. **Run tests before deployment**: Always run security tests before pushing to production
2. **Monitor test results**: Set up alerts for test failures
3. **Regular audits**: Run tests weekly even without code changes
4. **Update policies**: When adding new features, add corresponding RLS tests

## Additional Resources

- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [RLS Security Hardening Guide](./docs/RLS_SECURITY_HARDENING.md)
- [RLS Testing Guide](./docs/RLS_TESTING_GUIDE.md)

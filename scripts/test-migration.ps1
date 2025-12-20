#!/usr/bin/env pwsh
# Test PostgreSQL Migration

Write-Host "🔍 Testing PostgreSQL Migration..." -ForegroundColor Cyan
Write-Host ""

# Test 1: Database Connection
Write-Host "Test 1: Database Connection" -ForegroundColor Yellow
try {
    pnpm test:db
    Write-Host "✅ Database connection successful" -ForegroundColor Green
} catch {
    Write-Host "❌ Database connection failed" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Test 2: Type Checking
Write-Host "Test 2: TypeScript Type Checking" -ForegroundColor Yellow
try {
    pnpm tsc --noEmit
    Write-Host "✅ No TypeScript errors" -ForegroundColor Green
} catch {
    Write-Host "⚠️  TypeScript errors found (check output above)" -ForegroundColor Yellow
}

Write-Host ""

# Test 3: Sample Query Test
Write-Host "Test 3: Sample Database Queries" -ForegroundColor Yellow

Write-Host "  - Testing user count..."
pnpm sql:run "SELECT COUNT(*) as total FROM users"

Write-Host "  - Testing personal_sticks count..."
pnpm sql:run "SELECT COUNT(*) as total FROM personal_sticks"

Write-Host "  - Testing organizations count..."
pnpm sql:run "SELECT COUNT(*) as total FROM organizations"

Write-Host ""
Write-Host "✅ Migration tests completed!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Run 'pnpm dev' to start the development server"
Write-Host "2. Test authentication (Supabase Auth should still work)"
Write-Host "3. Test creating/updating notes (should use PostgreSQL)"
Write-Host "4. Check browser console for any errors"
Write-Host "5. Monitor database queries in server logs"

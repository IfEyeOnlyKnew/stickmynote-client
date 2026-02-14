# ============================================================================
# StickyMyNote - Production Update Script
# ============================================================================
# Run this script in PowerShell with Administrator privileges on the
# production server (HOL-DC2-IIS / 192.168.50.20)
#
# Usage: .\scripts\update-production.ps1
# ============================================================================

$ErrorActionPreference = "Stop"
$ProductionPath = "C:\stick-my-note-prod\stickmynote-client"

Write-Host "============================================" -ForegroundColor Cyan
Write-Host " StickyMyNote Production Update" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# --------------------------------------------------
# Step 1: Stop the service and kill node processes
# --------------------------------------------------
Write-Host "[1/7] Stopping StickyMyNote service..." -ForegroundColor Yellow
$ErrorActionPreference = "Continue"
net stop StickyMyNote 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "  Service stopped." -ForegroundColor Green
} else {
    Write-Host "  Service was not running or could not be stopped." -ForegroundColor DarkYellow
}

Write-Host "  Killing any remaining node.exe processes..." -ForegroundColor Yellow
taskkill /F /IM node.exe 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "  Node processes killed." -ForegroundColor Green
} else {
    Write-Host "  No node.exe processes found." -ForegroundColor DarkYellow
}
$ErrorActionPreference = "Stop"
Start-Sleep -Seconds 2

# --------------------------------------------------
# Step 2: Backup protected files
# --------------------------------------------------
Write-Host "[2/7] Backing up protected files..." -ForegroundColor Yellow
Set-Location $ProductionPath

$backups = @(
    @{ src = "server.js";       dst = "server.js.backup" },
    @{ src = ".env";            dst = ".env.backup" },
    @{ src = ".env.local";      dst = ".env.local.backup" },
    @{ src = ".env.production"; dst = ".env.production.backup" }
)

foreach ($b in $backups) {
    if (Test-Path $b.src) {
        Copy-Item $b.src $b.dst -Force
        Write-Host "  Backed up $($b.src)" -ForegroundColor Green
    }
}

# --------------------------------------------------
# Step 3: Delete old build folder
# --------------------------------------------------
Write-Host "[3/7] Removing old .next build folder..." -ForegroundColor Yellow
if (Test-Path ".next") {
    Remove-Item -Recurse -Force .next
    Write-Host "  .next folder removed." -ForegroundColor Green
} else {
    Write-Host "  .next folder not found, skipping." -ForegroundColor DarkYellow
}

# --------------------------------------------------
# Step 4: Fetch and selectively checkout from origin
# --------------------------------------------------
Write-Host "[4/7] Fetching latest from GitHub and checking out files..." -ForegroundColor Yellow
git fetch origin main

# Directories to update
$directories = @(
    "app/",
    "components/",
    "config/",
    "contexts/",
    "csrf/",
    "docs/",
    "hooks/",
    "lib/",
    "migrations/",
    "public/",
    "styles/",
    "types/",
    "utils/"
)

foreach ($dir in $directories) {
    Write-Host "  Checking out $dir" -ForegroundColor Gray
    git checkout origin/main -- $dir
}

# Individual config files to update (NEVER include server.js or .env files)
$configFiles = @(
    "components.json",
    "instrumentation.ts",
    "instrumentation-client.ts",
    "middleware.ts",
    "next.config.mjs",
    "package.json",
    "pnpm-lock.yaml",
    "postcss.config.mjs",
    "tailwind.config.ts",
    "tsconfig.json",
    "vercel.json"
)

foreach ($file in $configFiles) {
    Write-Host "  Checking out $file" -ForegroundColor Gray
    git checkout origin/main -- $file 2>$null
}

Write-Host "  Files updated from origin/main." -ForegroundColor Green

# --------------------------------------------------
# Step 5: Install dependencies
# --------------------------------------------------
Write-Host "[5/7] Installing dependencies..." -ForegroundColor Yellow
pnpm install
Write-Host "  Dependencies installed." -ForegroundColor Green

# --------------------------------------------------
# Step 6: Build production
# --------------------------------------------------
Write-Host "[6/7] Building production..." -ForegroundColor Yellow

# Use build-only env for build phase
if (Test-Path ".env.local.build-only") {
    Copy-Item ".env.local.build-only" ".env.local" -Force
    Write-Host "  Copied .env.local.build-only -> .env.local for build phase" -ForegroundColor Gray
}

pnpm run build

# CRITICAL: Remove build-only env after build
if (Test-Path ".env.local") {
    Remove-Item ".env.local" -Force
    Write-Host "  Removed .env.local after build (prevents empty POSTGRES_PASSWORD)" -ForegroundColor Green
}

Write-Host "  Build complete." -ForegroundColor Green

# --------------------------------------------------
# Step 7: Start the service
# --------------------------------------------------
Write-Host "[7/7] Starting StickyMyNote service..." -ForegroundColor Yellow
net start StickyMyNote
Start-Sleep -Seconds 5
Write-Host "  Service started." -ForegroundColor Green

# --------------------------------------------------
# Verification
# --------------------------------------------------
Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host " Verification Checks" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan

# Check server.js is HTTPS version
Write-Host ""
Write-Host "Checking server.js uses HTTPS..." -ForegroundColor Yellow
$httpsCheck = Select-String -Path "server.js" -Pattern 'require\("https"\)' -Quiet
if ($httpsCheck) {
    Write-Host "  PASS: server.js uses HTTPS" -ForegroundColor Green
} else {
    Write-Host "  FAIL: server.js may not be the HTTPS version!" -ForegroundColor Red
    Write-Host "  Restoring from backup..." -ForegroundColor Red
    Copy-Item "server.js.backup" "server.js" -Force
    Write-Host "  Restored server.js from backup." -ForegroundColor Yellow
}

# Check .env.local does NOT exist
Write-Host ""
Write-Host "Checking .env.local is removed..." -ForegroundColor Yellow
if (-not (Test-Path ".env.local")) {
    Write-Host "  PASS: .env.local does not exist" -ForegroundColor Green
} else {
    Write-Host "  FAIL: .env.local still exists! Removing..." -ForegroundColor Red
    Remove-Item ".env.local" -Force
    Write-Host "  Removed .env.local" -ForegroundColor Yellow
}

# Check port 443
Write-Host ""
Write-Host "Checking port 443..." -ForegroundColor Yellow
$portCheck = netstat -an | Select-String ":443"
if ($portCheck) {
    Write-Host "  PASS: Port 443 is listening" -ForegroundColor Green
} else {
    Write-Host "  WARN: Port 443 not detected yet (service may still be starting)" -ForegroundColor DarkYellow
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host " Update Complete!" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Manual verification steps:" -ForegroundColor White
Write-Host "  1. Browse to https://stickmynote.com" -ForegroundColor Gray
Write-Host "  2. Test sign-in works (catches DB connection issues)" -ForegroundColor Gray
Write-Host "  3. Run: nslookup stickmynote.com (should return 192.168.50.20)" -ForegroundColor Gray
Write-Host ""

param(
    [string]$AppPath = "C:\StickyNote",
    [string]$ServiceName = "StickyNoteService",
    [switch]$SkipBackup,
    [switch]$SkipTests
)

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Stick My Note - Windows Service Deployment" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Function to check if running as administrator
function Test-Administrator {
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

if (-not (Test-Administrator)) {
    Write-Host "ERROR: This script must be run as Administrator" -ForegroundColor Red
    exit 1
}

# Step 1: Backup existing installation
if (-not $SkipBackup) {
    Write-Host "[1/8] Creating backup..." -ForegroundColor Yellow
    $backupPath = "$AppPath.backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    if (Test-Path $AppPath) {
        Copy-Item -Path $AppPath -Destination $backupPath -Recurse -Force
        Write-Host "  Backup created: $backupPath" -ForegroundColor Green
    } else {
        Write-Host "  No existing installation found, skipping backup" -ForegroundColor Gray
    }
} else {
    Write-Host "[1/8] Skipping backup..." -ForegroundColor Gray
}

# Step 2: Stop service if running
Write-Host "[2/8] Stopping service..." -ForegroundColor Yellow
$service = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($service) {
    if ($service.Status -eq "Running") {
        Stop-Service -Name $ServiceName -Force
        Write-Host "  Service stopped" -ForegroundColor Green
    } else {
        Write-Host "  Service already stopped" -ForegroundColor Gray
    }
} else {
    Write-Host "  Service not installed yet" -ForegroundColor Gray
}

# Step 3: Deploy application files
Write-Host "[3/8] Deploying application files..." -ForegroundColor Yellow
if (-not (Test-Path $AppPath)) {
    New-Item -ItemType Directory -Path $AppPath -Force | Out-Null
}

# Copy build files (assumes you're running this from the project directory)
$sourceFiles = @(".next", "public", "node_modules", "package.json", "package-lock.json", "next.config.mjs", "server.js", ".env.production")
foreach ($file in $sourceFiles) {
    if (Test-Path $file) {
        Write-Host "  Copying $file..." -ForegroundColor Gray
        Copy-Item -Path $file -Destination $AppPath -Recurse -Force
    }
}
Write-Host "  Application files deployed" -ForegroundColor Green

# Step 4: Install/Update dependencies
Write-Host "[4/8] Installing dependencies..." -ForegroundColor Yellow
Push-Location $AppPath
npm ci --production
Pop-Location
Write-Host "  Dependencies installed" -ForegroundColor Green

# Step 5: Create required directories
Write-Host "[5/8] Creating directories..." -ForegroundColor Yellow
$dirs = @("$AppPath\logs", "$AppPath\uploads", "$AppPath\uploads\avatars", "$AppPath\uploads\images", "$AppPath\uploads\documents")
foreach ($dir in $dirs) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
        Write-Host "  Created: $dir" -ForegroundColor Gray
    }
}

# Set permissions
icacls "$AppPath\logs" /grant "NetworkService:(OI)(CI)M" /T | Out-Null
icacls "$AppPath\uploads" /grant "NetworkService:(OI)(CI)M" /T | Out-Null
Write-Host "  Directories configured" -ForegroundColor Green

# Step 6: Test configuration
if (-not $SkipTests) {
    Write-Host "[6/8] Testing configuration..." -ForegroundColor Yellow
    
    # Check environment file
    if (Test-Path "$AppPath\.env.production") {
        Write-Host "  Environment file found" -ForegroundColor Green
    } else {
        Write-Host "  WARNING: No .env.production file found!" -ForegroundColor Red
        Write-Host "  Copy .env.windows.production to .env.production and configure it" -ForegroundColor Yellow
    }
    
    # Check Node.js
    $nodeVersion = node --version
    Write-Host "  Node.js version: $nodeVersion" -ForegroundColor Green
    
} else {
    Write-Host "[6/8] Skipping tests..." -ForegroundColor Gray
}

# Step 7: Install/Update service
Write-Host "[7/8] Installing service..." -ForegroundColor Yellow
if (-not (Get-Command nssm -ErrorAction SilentlyContinue)) {
    Write-Host "  ERROR: NSSM not found. Please install NSSM first:" -ForegroundColor Red
    Write-Host "  Download from: https://nssm.cc/download" -ForegroundColor Yellow
    exit 1
}

# Remove existing service if present
$existingService = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($existingService) {
    Write-Host "  Removing existing service..." -ForegroundColor Gray
    nssm remove $ServiceName confirm
}

# Install service
$nodePath = (Get-Command node).Path
nssm install $ServiceName "$nodePath"
nssm set $ServiceName AppDirectory "$AppPath"
nssm set $ServiceName AppParameters "server.js"
nssm set $ServiceName DisplayName "Stick My Note Application"
nssm set $ServiceName Description "Stick My Note - Collaborative Note-Taking Application"
nssm set $ServiceName Start SERVICE_AUTO_START
nssm set $ServiceName AppEnvironmentExtra "NODE_ENV=production"
nssm set $ServiceName AppStdout "$AppPath\logs\service-output.log"
nssm set $ServiceName AppStderr "$AppPath\logs\service-error.log"
nssm set $ServiceName AppStdoutCreationDisposition 4
nssm set $ServiceName AppStderrCreationDisposition 4
nssm set $ServiceName AppRotateFiles 1
nssm set $ServiceName AppRotateOnline 1
nssm set $ServiceName AppRotateSeconds 86400
nssm set $ServiceName AppRotateBytes 10485760
Write-Host "  Service installed" -ForegroundColor Green

# Step 8: Start service
Write-Host "[8/8] Starting service..." -ForegroundColor Yellow
nssm start $ServiceName

# Wait for service to start
Start-Sleep -Seconds 5

$service = Get-Service -Name $ServiceName
if ($service.Status -eq "Running") {
    Write-Host "  Service started successfully" -ForegroundColor Green
} else {
    Write-Host "  WARNING: Service did not start. Check logs at $AppPath\logs" -ForegroundColor Red
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Deployment Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Service Name: $ServiceName" -ForegroundColor White
Write-Host "Service Status: $($service.Status)" -ForegroundColor White
Write-Host "Application Path: $AppPath" -ForegroundColor White
Write-Host "Logs: $AppPath\logs\" -ForegroundColor White
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "1. Check service logs: Get-Content $AppPath\logs\service-output.log -Tail 50" -ForegroundColor Gray
Write-Host "2. Test health endpoint: Invoke-RestMethod http://localhost:3000/api/health/deployment" -ForegroundColor Gray
Write-Host "3. Configure server settings: https://your-domain.com/settings/organization" -ForegroundColor Gray
Write-Host ""

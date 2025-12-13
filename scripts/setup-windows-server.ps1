# PowerShell script to setup Windows Server deployment
# Run as Administrator

Write-Host "=== Stick My Note - Windows Server Setup ===" -ForegroundColor Green
Write-Host ""

# Check if running as Administrator
$currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "ERROR: This script must be run as Administrator!" -ForegroundColor Red
    exit 1
}

# Configuration
$appPath = "C:\inetpub\stickmynote"
$uploadPath = "$appPath\uploads"
$siteName = "StickyNote"
$appPoolName = "StickyNoteAppPool"
$hostHeader = "www.stickmynote.com"

Write-Host "Step 1: Creating application directories..." -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path $appPath | Out-Null
New-Item -ItemType Directory -Force -Path "$uploadPath\avatars" | Out-Null
New-Item -ItemType Directory -Force -Path "$uploadPath\images" | Out-Null
New-Item -ItemType Directory -Force -Path "$uploadPath\documents" | Out-Null
New-Item -ItemType Directory -Force -Path "$uploadPath\media" | Out-Null
New-Item -ItemType Directory -Force -Path "$appPath\logs" | Out-Null
Write-Host "✓ Directories created" -ForegroundColor Green

Write-Host ""
Write-Host "Step 2: Setting NTFS permissions..." -ForegroundColor Yellow
icacls $appPath /grant "IIS_IUSRS:(OI)(CI)F" /T | Out-Null
icacls $uploadPath /grant "IIS_IUSRS:(OI)(CI)M" /T | Out-Null
Write-Host "✓ Permissions configured" -ForegroundColor Green

Write-Host ""
Write-Host "Step 3: Creating IIS Application Pool..." -ForegroundColor Yellow
Import-Module WebAdministration
if (Test-Path "IIS:\AppPools\$appPoolName") {
    Remove-WebAppPool -Name $appPoolName
}
New-WebAppPool -Name $appPoolName | Out-Null
Set-ItemProperty "IIS:\AppPools\$appPoolName" -name "managedRuntimeVersion" -value ""
Set-ItemProperty "IIS:\AppPools\$appPoolName" -name "enable32BitAppOnWin64" -value $false
Write-Host "✓ Application pool created" -ForegroundColor Green

Write-Host ""
Write-Host "Step 4: Creating IIS Website..." -ForegroundColor Yellow
if (Test-Path "IIS:\Sites\$siteName") {
    Remove-Website -Name $siteName
}
New-Website -Name $siteName `
    -Port 80 `
    -HostHeader $hostHeader `
    -PhysicalPath $appPath `
    -ApplicationPool $appPoolName | Out-Null
Write-Host "✓ Website created" -ForegroundColor Green

Write-Host ""
Write-Host "Step 5: Configuring PostgreSQL..." -ForegroundColor Yellow
$pgService = Get-Service -Name "postgresql*" -ErrorAction SilentlyContinue
if ($pgService) {
    Write-Host "✓ PostgreSQL service found: $($pgService.DisplayName)" -ForegroundColor Green
} else {
    Write-Host "⚠ PostgreSQL not detected. Please install PostgreSQL 15+ manually." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Step 6: Configuring Redis..." -ForegroundColor Yellow
$redisService = Get-Service -Name "Redis" -ErrorAction SilentlyContinue
if ($redisService) {
    Start-Service -Name "Redis"
    Write-Host "✓ Redis service started" -ForegroundColor Green
} else {
    Write-Host "⚠ Redis not detected. Please install Redis for Windows manually." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== Setup Complete ===" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Copy your application files to: $appPath"
Write-Host "2. Configure .env.production with your settings"
Write-Host "3. Install SSL certificate in IIS"
Write-Host "4. Run database migrations"
Write-Host "5. Start the website: Start-Website -Name '$siteName'"
Write-Host ""

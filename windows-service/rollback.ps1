param(
    [Parameter(Mandatory=$true)]
    [string]$BackupPath,
    [string]$AppPath = "C:\StickyNote",
    [string]$ServiceName = "StickyNoteService"
)

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Stick My Note - Rollback to Previous Version" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Verify backup exists
if (-not (Test-Path $BackupPath)) {
    Write-Host "ERROR: Backup not found at $BackupPath" -ForegroundColor Red
    exit 1
}

Write-Host "Backup found: $BackupPath" -ForegroundColor Green
Write-Host ""

# Stop service
Write-Host "[1/3] Stopping service..." -ForegroundColor Yellow
$service = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($service -and $service.Status -eq "Running") {
    Stop-Service -Name $ServiceName -Force
    Write-Host "  Service stopped" -ForegroundColor Green
}

# Backup current (failed) version
Write-Host "[2/3] Backing up current version..." -ForegroundColor Yellow
$failedBackup = "$AppPath.failed-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
Move-Item -Path $AppPath -Destination $failedBackup -Force
Write-Host "  Current version backed up to: $failedBackup" -ForegroundColor Green

# Restore backup
Write-Host "[3/3] Restoring backup..." -ForegroundColor Yellow
Copy-Item -Path $BackupPath -Destination $AppPath -Recurse -Force
Write-Host "  Backup restored" -ForegroundColor Green

# Start service
Write-Host ""
Write-Host "Starting service..." -ForegroundColor Yellow
Start-Service -Name $ServiceName
Start-Sleep -Seconds 5

$service = Get-Service -Name $ServiceName
Write-Host "Service status: $($service.Status)" -ForegroundColor $(if($service.Status -eq "Running"){"Green"}else{"Red"})

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Rollback Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan

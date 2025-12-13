<#
.SYNOPSIS
    Uninstalls Sticky Note Application Windows Service

.DESCRIPTION
    Stops and removes the Sticky Note Windows Service

.NOTES
    Run this script as Administrator
#>

# Require Administrator
if (-NOT ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Write-Error "This script must be run as Administrator"
    exit 1
}

$SERVICE_NAME = "StickyNoteApp"
$NSSM_PATH = "C:\Program Files\nssm\nssm.exe"

Write-Host "=== Uninstalling Sticky Note Windows Service ===" -ForegroundColor Cyan

# Check if service exists
$service = Get-Service -Name $SERVICE_NAME -ErrorAction SilentlyContinue
if (-not $service) {
    Write-Host "Service $SERVICE_NAME does not exist" -ForegroundColor Yellow
    exit 0
}

# Stop service if running
if ($service.Status -eq "Running") {
    Write-Host "Stopping service..." -ForegroundColor Yellow
    & $NSSM_PATH stop $SERVICE_NAME
    Start-Sleep -Seconds 3
}

# Remove service
Write-Host "Removing service..." -ForegroundColor Yellow
& $NSSM_PATH remove $SERVICE_NAME confirm

Start-Sleep -Seconds 2

# Verify removal
$service = Get-Service -Name $SERVICE_NAME -ErrorAction SilentlyContinue
if (-not $service) {
    Write-Host "Service uninstalled successfully!" -ForegroundColor Green
} else {
    Write-Error "Failed to uninstall service"
}

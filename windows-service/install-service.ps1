<#
.SYNOPSIS
    Installs Sticky Note Application as a Windows Service using NSSM

.DESCRIPTION
    This script installs the Sticky Note application as a Windows Service
    using NSSM (Non-Sucking Service Manager) for reliable operation.

.NOTES
    Run this script as Administrator
    Download NSSM from https://nssm.cc/download
#>

# Require Administrator
if (-NOT ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Write-Error "This script must be run as Administrator"
    exit 1
}

# Configuration
$SERVICE_NAME = "StickyNoteApp"
$APP_PATH = "C:\inetpub\stickmynote"
$NODE_PATH = "C:\Program Files\nodejs\node.exe"
$SERVER_SCRIPT = "server.js"
$LOG_PATH = "$APP_PATH\logs"
$NSSM_PATH = "C:\Program Files\nssm\nssm.exe"

Write-Host "=== Sticky Note Windows Service Installation ===" -ForegroundColor Cyan

# Check if NSSM is installed
if (-not (Test-Path $NSSM_PATH)) {
    Write-Host "NSSM not found at $NSSM_PATH" -ForegroundColor Yellow
    Write-Host "Please download NSSM from https://nssm.cc/download" -ForegroundColor Yellow
    Write-Host "Extract to C:\Program Files\nssm\" -ForegroundColor Yellow
    exit 1
}

# Check if Node.js is installed
if (-not (Test-Path $NODE_PATH)) {
    Write-Error "Node.js not found at $NODE_PATH"
    Write-Host "Please install Node.js 20 LTS from https://nodejs.org" -ForegroundColor Yellow
    exit 1
}

# Check if application directory exists
if (-not (Test-Path $APP_PATH)) {
    Write-Error "Application directory not found at $APP_PATH"
    exit 1
}

# Create logs directory
if (-not (Test-Path $LOG_PATH)) {
    New-Item -ItemType Directory -Path $LOG_PATH -Force | Out-Null
    Write-Host "Created logs directory: $LOG_PATH" -ForegroundColor Green
}

# Check if service already exists
$existingService = Get-Service -Name $SERVICE_NAME -ErrorAction SilentlyContinue
if ($existingService) {
    Write-Host "Service already exists. Removing..." -ForegroundColor Yellow
    & $NSSM_PATH stop $SERVICE_NAME
    & $NSSM_PATH remove $SERVICE_NAME confirm
    Start-Sleep -Seconds 2
}

Write-Host "Installing service..." -ForegroundColor Cyan

# Install service
& $NSSM_PATH install $SERVICE_NAME $NODE_PATH "$APP_PATH\$SERVER_SCRIPT"

# Configure service
& $NSSM_PATH set $SERVICE_NAME AppDirectory $APP_PATH
& $NSSM_PATH set $SERVICE_NAME DisplayName "Sticky Note Application"
& $NSSM_PATH set $SERVICE_NAME Description "Sticky Note collaboration application running on Node.js"
& $NSSM_PATH set $SERVICE_NAME Start SERVICE_AUTO_START

# Set environment variables
& $NSSM_PATH set $SERVICE_NAME AppEnvironmentExtra NODE_ENV=production
& $NSSM_PATH set $SERVICE_NAME AppEnvironmentExtra PORT=3000

# Configure logging
& $NSSM_PATH set $SERVICE_NAME AppStdout "$LOG_PATH\service-output.log"
& $NSSM_PATH set $SERVICE_NAME AppStderr "$LOG_PATH\service-error.log"
& $NSSM_PATH set $SERVICE_NAME AppStdoutCreationDisposition 4
& $NSSM_PATH set $SERVICE_NAME AppStderrCreationDisposition 4
& $NSSM_PATH set $SERVICE_NAME AppRotateFiles 1
& $NSSM_PATH set $SERVICE_NAME AppRotateOnline 1
& $NSSM_PATH set $SERVICE_NAME AppRotateSeconds 86400
& $NSSM_PATH set $SERVICE_NAME AppRotateBytes 10485760

# Configure service recovery
& $NSSM_PATH set $SERVICE_NAME AppExit Default Restart
& $NSSM_PATH set $SERVICE_NAME AppRestartDelay 5000
& $NSSM_PATH set $SERVICE_NAME AppThrottle 10000

Write-Host "Service installed successfully!" -ForegroundColor Green

# Start service
Write-Host "Starting service..." -ForegroundColor Cyan
& $NSSM_PATH start $SERVICE_NAME

Start-Sleep -Seconds 3

# Check service status
$service = Get-Service -Name $SERVICE_NAME
if ($service.Status -eq "Running") {
    Write-Host "Service is running!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Service Details:" -ForegroundColor Cyan
    Write-Host "  Name: $SERVICE_NAME" -ForegroundColor White
    Write-Host "  Status: $($service.Status)" -ForegroundColor Green
    Write-Host "  Startup Type: $($service.StartType)" -ForegroundColor White
    Write-Host "  Log Path: $LOG_PATH" -ForegroundColor White
    Write-Host ""
    Write-Host "Useful Commands:" -ForegroundColor Cyan
    Write-Host "  Start:   net start $SERVICE_NAME" -ForegroundColor White
    Write-Host "  Stop:    net stop $SERVICE_NAME" -ForegroundColor White
    Write-Host "  Restart: net stop $SERVICE_NAME && net start $SERVICE_NAME" -ForegroundColor White
    Write-Host "  Status:  Get-Service $SERVICE_NAME" -ForegroundColor White
} else {
    Write-Error "Service failed to start. Check logs at $LOG_PATH"
    Write-Host "View logs: Get-Content $LOG_PATH\service-error.log -Tail 50" -ForegroundColor Yellow
}

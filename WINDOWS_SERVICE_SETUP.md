# Windows Service Setup Guide

This guide explains how to run Sticky Note Application as a Windows Service for reliable 24/7 operation.

## Why Use a Windows Service?

Running as a Windows Service provides:
- **Automatic startup** on server boot
- **Automatic restart** on crashes
- **Background operation** without logged-in user
- **System integration** with Windows Service Manager
- **Logging and monitoring** through Windows Event Log

## Prerequisites

1. **NSSM (Non-Sucking Service Manager)**
   - Download from https://nssm.cc/download
   - Extract to `C:\Program Files\nssm\`
   - Add to system PATH

2. **Node.js 20 LTS**
   - Installed at `C:\Program Files\nodejs\`

3. **Application deployed** at `C:\inetpub\stickmynote\`

## Installation Methods

### Method 1: Using IIS (Recommended for Web Hosting)

If you're using IIS with iisnode, the application runs within IIS process:

\`\`\`powershell
# IIS automatically manages the Node.js process
# No additional service needed
# Restart IIS to restart the app:
iisreset
\`\`\`

**Pros:**
- Integrated with IIS logging and monitoring
- SSL/TLS handled by IIS
- Works with existing IIS infrastructure
- Multiple sites on one server

**Cons:**
- Tied to IIS lifecycle
- More complex configuration

### Method 2: Using NSSM (Recommended for Standalone Deployment)

For standalone deployment without IIS:

\`\`\`powershell
# Install as Windows Service
cd C:\inetpub\stickmynote\windows-service
.\install-service.ps1
\`\`\`

The service will:
- Start automatically on boot
- Restart automatically on failure
- Log to `C:\inetpub\stickmynote\logs\`
- Run under Local System account (or specify custom account)

**Pros:**
- Simple, lightweight
- Independent of IIS
- Easy to manage with standard Windows tools
- Can run on port 80/443 directly

**Cons:**
- Need reverse proxy for HTTPS (Nginx or HTTP.sys)
- Manual SSL certificate management

## Service Management

### Using PowerShell/Command Prompt

\`\`\`powershell
# Start service
net start StickyNoteApp

# Stop service
net stop StickyNoteApp

# Restart service
net stop StickyNoteApp && net start StickyNoteApp

# Check status
Get-Service StickyNoteApp

# View service configuration
sc qc StickyNoteApp
\`\`\`

### Using Services MMC

1. Press `Win + R`, type `services.msc`, press Enter
2. Find "Sticky Note Application"
3. Right-click for Start, Stop, Restart, Properties

### Using NSSM GUI

\`\`\`powershell
# Edit service configuration
nssm edit StickyNoteApp
\`\`\`

## Monitoring and Logs

### Service Logs

\`\`\`powershell
# View output logs
Get-Content C:\inetpub\stickmynote\logs\service-output.log -Tail 50 -Wait

# View error logs
Get-Content C:\inetpub\stickmynote\logs\service-error.log -Tail 50 -Wait
\`\`\`

### Windows Event Log

\`\`\`powershell
# View recent service events
Get-EventLog -LogName Application -Source StickyNoteApp -Newest 20
\`\`\`

### Health Check

\`\`\`powershell
# Test if application is responding
Invoke-WebRequest http://localhost:3000/api/health
\`\`\`

## Uninstallation

\`\`\`powershell
cd C:\inetpub\stickmynote\windows-service
.\uninstall-service.ps1
\`\`\`

## Troubleshooting

### Service won't start

1. **Check logs:**
   \`\`\`powershell
   Get-Content C:\inetpub\stickmynote\logs\service-error.log
   \`\`\`

2. **Verify Node.js path:**
   \`\`\`powershell
   Test-Path "C:\Program Files\nodejs\node.exe"
   \`\`\`

3. **Check permissions:**
   \`\`\`powershell
   icacls C:\inetpub\stickmynote /verify
   \`\`\`

4. **Test manually:**
   \`\`\`powershell
   cd C:\inetpub\stickmynote
   node server.js
   \`\`\`

### Service crashes frequently

1. **Increase restart delay:**
   \`\`\`powershell
   nssm set StickyNoteApp AppRestartDelay 10000
   \`\`\`

2. **Check memory usage:**
   \`\`\`powershell
   Get-Process -Name node | Select-Object PM, VM
   \`\`\`

3. **Review error logs** for exceptions

### Port conflicts

If port 3000 is already in use:

\`\`\`powershell
# Find what's using port 3000
netstat -ano | findstr :3000

# Change service port
nssm set StickyNoteApp AppEnvironmentExtra PORT=3001
nssm restart StickyNoteApp
\`\`\`

## Performance Tuning

### Memory Limits

\`\`\`powershell
# Set Node.js max memory (4GB)
nssm set StickyNoteApp AppEnvironmentExtra NODE_OPTIONS=--max-old-space-size=4096
\`\`\`

### CPU Affinity

\`\`\`powershell
# Limit to specific CPU cores (0-3)
nssm set StickyNoteApp AppAffinity 0-3
\`\`\`

### Priority

\`\`\`powershell
# Set process priority
nssm set StickyNoteApp AppPriority ABOVE_NORMAL
\`\`\`

## Security Best Practices

### Run under dedicated account

\`\`\`powershell
# Create service account
$password = ConvertTo-SecureString "SecurePassword123!" -AsPlainText -Force
New-LocalUser "StickyNoteService" -Password $password -Description "Service account for Sticky Note App"

# Grant log on as service right
# Use Local Security Policy (secpol.msc):
# Local Policies > User Rights Assignment > Log on as a service

# Set service to use account
nssm set StickyNoteApp ObjectName ".\StickyNoteService" "SecurePassword123!"
\`\`\`

### File permissions

\`\`\`powershell
# Grant minimal permissions
icacls C:\inetpub\stickmynote /grant "StickyNoteService:(OI)(CI)RX" /T
icacls C:\inetpub\stickmynote\uploads /grant "StickyNoteService:(OI)(CI)M" /T
icacls C:\inetpub\stickmynote\logs /grant "StickyNoteService:(OI)(CI)M" /T
\`\`\`

## Backup and Recovery

### Create system restore point

\`\`\`powershell
# Before making changes
Checkpoint-Computer -Description "Before Sticky Note Service Installation"
\`\`\`

### Backup service configuration

\`\`\`powershell
# Export service settings
nssm dump StickyNoteApp > C:\Backup\stickmynote-service-config.txt
\`\`\`

### Disaster recovery

1. Reinstall application files
2. Run install-service.ps1
3. Restore environment variables from backup
4. Start service

## Advanced Configuration

### Multiple instances

Run multiple instances on different ports:

\`\`\`powershell
# Install second instance
nssm install StickyNoteApp2 "C:\Program Files\nodejs\node.exe" "C:\inetpub\stickmynote2\server.js"
nssm set StickyNoteApp2 AppDirectory "C:\inetpub\stickmynote2"
nssm set StickyNoteApp2 AppEnvironmentExtra PORT=3001
\`\`\`

### Load balancing

Use IIS ARR or Nginx to load balance across multiple service instances.

## Next Steps

- Configure SSL/TLS (see WINDOWS_SERVER_DEPLOYMENT.md)
- Set up monitoring (Performance Monitor, Application Insights)
- Configure automated backups
- Set up log rotation and archival
- Test failover and recovery procedures

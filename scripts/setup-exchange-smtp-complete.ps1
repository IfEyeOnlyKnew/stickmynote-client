# ============================================================================
# COMPLETE EXCHANGE SMTP SETUP FOR STICKYNOTE
# Run this script directly on HOL-DC4-EXCH (192.168.50.40)
# ============================================================================
# This script will:
# 1. Create service account (stickmynote_svc)
# 2. Enable mailbox with noreply@stickmynote.com
# 3. Configure SMTP receive connector for web server
# 4. Grant necessary permissions
# 5. Test email delivery
# ============================================================================

param(
    [string]$ServiceAccountPassword,
    [string]$Domain = "stickmynote.com",
    [string]$WebServerIP = "192.168.50.20"
)

$ErrorActionPreference = "Continue"

Write-Host "`n" -NoNewline
Write-Host "═══════════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "   STICKYNOTE EXCHANGE SERVER SMTP CONFIGURATION" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# Verify we're on Exchange server
$hostname = $env:COMPUTERNAME
Write-Host "Current Server: $hostname" -ForegroundColor Yellow
Write-Host "Target Server: HOL-DC4-EXCH" -ForegroundColor Yellow
Write-Host ""

if ($hostname -ne "HOL-DC4-EXCH") {
    Write-Host "⚠️  WARNING: This script should run on HOL-DC4-EXCH" -ForegroundColor Red
    $continue = Read-Host "Continue anyway? (yes/no)"
    if ($continue -ne "yes") {
        Write-Host "Script cancelled." -ForegroundColor Yellow
        exit
    }
}

# Get password if not provided
if (-not $ServiceAccountPassword) {
    Write-Host "📝 Service Account Configuration" -ForegroundColor Cyan
    Write-Host "   Account: stickmynote_svc" -ForegroundColor White
    Write-Host "   Email: noreply@$Domain" -ForegroundColor White
    Write-Host ""
    $securePassword = Read-Host -AsSecureString "Enter password for service account"
    $BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
    $ServiceAccountPassword = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
}

# ============================================================================
# STEP 1: CREATE SERVICE ACCOUNT
# ============================================================================
Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "[STEP 1/5] Creating Service Account" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

try {
    # Check if account already exists
    $existingUser = Get-ADUser -Identity "stickmynote_svc" -ErrorAction SilentlyContinue
    
    if ($existingUser) {
        Write-Host "   ℹ️  Service account already exists" -ForegroundColor Yellow
        Write-Host "   Name: $($existingUser.Name)" -ForegroundColor White
        Write-Host "   UPN: $($existingUser.UserPrincipalName)" -ForegroundColor White
    } else {
        Write-Host "   Creating new service account..." -ForegroundColor White
        
        $securePass = ConvertTo-SecureString $ServiceAccountPassword -AsPlainText -Force
        
        New-ADUser -Name "StickyNote Service" `
            -SamAccountName "stickmynote_svc" `
            -UserPrincipalName "stickmynote@$Domain" `
            -AccountPassword $securePass `
            -Enabled $true `
            -PasswordNeverExpires $true `
            -CannotChangePassword $true `
            -Description "Service account for StickyNote application SMTP relay" `
            -ErrorAction Stop
        
        Write-Host "   ✅ Service account created successfully" -ForegroundColor Green
        Write-Host "   Username: stickmynote@$Domain" -ForegroundColor White
        Write-Host "   Password: ***" -ForegroundColor White
    }
} catch {
    Write-Host "   ❌ Error creating service account: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "   Continuing with next steps..." -ForegroundColor Yellow
}

# ============================================================================
# STEP 2: CREATE MAILBOX
# ============================================================================
Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "[STEP 2/5] Creating Mailbox" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

try {
    # Check if mailbox exists
    $existingMailbox = Get-Mailbox -Identity "stickmynote_svc" -ErrorAction SilentlyContinue
    
    if ($existingMailbox) {
        Write-Host "   ℹ️  Mailbox already exists" -ForegroundColor Yellow
        Write-Host "   Primary Email: $($existingMailbox.PrimarySmtpAddress)" -ForegroundColor White
    } else {
        Write-Host "   Enabling mailbox..." -ForegroundColor White
        
        Enable-Mailbox -Identity "stickmynote_svc" -Alias "stickmynote" -ErrorAction Stop
        
        Write-Host "   ✅ Mailbox enabled" -ForegroundColor Green
        
        # Wait for mailbox to be created
        Write-Host "   ⏳ Waiting for mailbox creation..." -ForegroundColor White
        Start-Sleep -Seconds 5
    }
    
    # Set email address
    Write-Host "   Setting email address to noreply@$Domain..." -ForegroundColor White
    
    Set-Mailbox -Identity "stickmynote_svc" `
        -EmailAddresses "SMTP:noreply@$Domain" `
        -HiddenFromAddressListsEnabled $true `
        -ErrorAction Stop
    
    Write-Host "   ✅ Email address configured: noreply@$Domain" -ForegroundColor Green
    
} catch {
    Write-Host "   ❌ Error creating mailbox: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "   Continuing with next steps..." -ForegroundColor Yellow
}

# ============================================================================
# STEP 3: GRANT SEND PERMISSIONS
# ============================================================================
Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "[STEP 3/5] Granting Send Permissions" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

try {
    Write-Host "   Granting Send-As permissions..." -ForegroundColor White
    
    Add-ADPermission -Identity "stickmynote_svc" `
        -User "stickmynote_svc" `
        -ExtendedRights "Send-As" `
        -ErrorAction Stop
    
    Write-Host "   ✅ Send-As permissions granted" -ForegroundColor Green
    
} catch {
    if ($_.Exception.Message -like "*already exists*") {
        Write-Host "   ℹ️  Permission already exists" -ForegroundColor Yellow
    } else {
        Write-Host "   ⚠️  Warning: $($_.Exception.Message)" -ForegroundColor Yellow
        Write-Host "   This may not be critical if permission already exists" -ForegroundColor White
    }
}

# ============================================================================
# STEP 4: CONFIGURE RECEIVE CONNECTOR
# ============================================================================
Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "[STEP 4/5] Configuring Receive Connector" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

$connectorName = "StickyNote Web Server Relay"

try {
    # Check if connector exists
    $existingConnector = Get-ReceiveConnector | Where-Object { $_.Name -eq $connectorName } | Select-Object -First 1
    
    if ($existingConnector) {
        Write-Host "   ℹ️  Receive connector already exists" -ForegroundColor Yellow
        Write-Host "   Name: $($existingConnector.Name)" -ForegroundColor White
        Write-Host "   Bindings: $($existingConnector.Bindings -join ', ')" -ForegroundColor White
        
        Write-Host "   Updating connector settings..." -ForegroundColor White
        
        # Update existing connector - rebuild IP list as strings to avoid deserialization issues
        $connectorIdentity = "$($env:COMPUTERNAME)\$connectorName"
        
        # Get current remote IP ranges as strings and add web server if not present
        $currentIPStrings = @()
        foreach ($ip in $existingConnector.RemoteIPRanges) {
            $currentIPStrings += $ip.ToString()
        }
        
        if ($currentIPStrings -notcontains $WebServerIP) {
            $currentIPStrings += $WebServerIP
        }
        
        Set-ReceiveConnector -Identity $connectorIdentity `
            -RemoteIPRanges $currentIPStrings `
            -AuthMechanism TLS, BasicAuth, BasicAuthRequireTLS `
            -PermissionGroups ExchangeUsers `
            -RequireTLS $true `
            -ErrorAction Stop
        
        Write-Host "   ✅ Receive connector updated" -ForegroundColor Green
        
    } else {
        Write-Host "   Creating new receive connector..." -ForegroundColor White
        
        # Get the Exchange server name
        $serverName = $env:COMPUTERNAME
        
        New-ReceiveConnector -Name $connectorName `
            -Server $serverName `
            -TransportRole FrontendTransport `
            -Bindings "192.168.50.40:587" `
            -RemoteIPRanges $WebServerIP `
            -AuthMechanism TLS, BasicAuth, BasicAuthRequireTLS `
            -PermissionGroups ExchangeUsers `
            -RequireTLS $true `
            -ErrorAction Stop
        
        Write-Host "   ✅ Receive connector created" -ForegroundColor Green
    }
    
    Write-Host "   Configuration:" -ForegroundColor White
    Write-Host "      Port: 587" -ForegroundColor White
    Write-Host "      Allowed IP: $WebServerIP" -ForegroundColor White
    Write-Host "      Auth: TLS + BasicAuth" -ForegroundColor White
    Write-Host "      TLS Required: Yes" -ForegroundColor White
    
} catch {
    Write-Host "   ❌ Error configuring connector: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "   ℹ️  Alternative: Update default receive connector" -ForegroundColor Yellow
    Write-Host "   Run this command manually:" -ForegroundColor White
    Write-Host "   Get-ReceiveConnector | Where-Object {`$_.Name -like '*Default*'} | Set-ReceiveConnector -RemoteIPRanges @{Add='$WebServerIP'}" -ForegroundColor Gray
}

# ============================================================================
# STEP 5: TEST EMAIL
# ============================================================================
Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "[STEP 5/5] Testing Email Delivery" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

$testEmail = Read-Host "Enter email address to send test message (or press Enter to skip)"

if ($testEmail) {
    try {
        Write-Host "   Sending test email to $testEmail..." -ForegroundColor White
        
        $securePass = ConvertTo-SecureString $ServiceAccountPassword -AsPlainText -Force
        $credential = New-Object System.Management.Automation.PSCredential("stickmynote@$Domain", $securePass)
        
        Send-MailMessage `
            -To $testEmail `
            -From "noreply@$Domain" `
            -Subject "Test Email from StickyNote Application" `
            -Body "This is a test email from the StickyNote application.`n`nIf you received this message, SMTP relay is configured correctly!`n`nConfiguration:`n- Server: 192.168.50.40`n- Port: 587`n- From: noreply@$Domain`n`nSent at: $(Get-Date)" `
            -SmtpServer "192.168.50.40" `
            -Port 587 `
            -UseSsl `
            -Credential $credential `
            -ErrorAction Stop
        
        Write-Host "   ✅ Test email sent successfully!" -ForegroundColor Green
        Write-Host "   Check $testEmail for the message" -ForegroundColor White
        
    } catch {
        Write-Host "   ❌ Error sending test email: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host ""
        Write-Host "   Troubleshooting tips:" -ForegroundColor Yellow
        Write-Host "   - Verify the password is correct" -ForegroundColor White
        Write-Host "   - Check Exchange logs for details" -ForegroundColor White
        Write-Host "   - Ensure port 587 is not blocked by firewall" -ForegroundColor White
    }
} else {
    Write-Host "   ⏭️  Test skipped" -ForegroundColor Yellow
}

# ============================================================================
# SUMMARY
# ============================================================================
Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "   CONFIGURATION SUMMARY" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""

Write-Host "📧 SMTP Configuration for Application:" -ForegroundColor Cyan
Write-Host ""
Write-Host "   SMTP_HOST=192.168.50.40" -ForegroundColor White
Write-Host "   SMTP_PORT=587" -ForegroundColor White
Write-Host "   SMTP_SECURE=true" -ForegroundColor White
Write-Host "   SMTP_USER=stickmynote@$Domain" -ForegroundColor White
Write-Host "   SMTP_PASSWORD=[password you entered]" -ForegroundColor White
Write-Host "   SMTP_FROM=noreply@$Domain" -ForegroundColor White
Write-Host ""

Write-Host "✅ Configuration Steps Completed:" -ForegroundColor Cyan
Write-Host "   [1] Service account created/verified" -ForegroundColor White
Write-Host "   [2] Mailbox enabled and configured" -ForegroundColor White
Write-Host "   [3] Send permissions granted" -ForegroundColor White
Write-Host "   [4] Receive connector configured" -ForegroundColor White
Write-Host "   [5] Test email sent (if requested)" -ForegroundColor White
Write-Host ""

Write-Host "📝 Next Steps:" -ForegroundColor Cyan
Write-Host "   1. Verify .env.local on Web Server has correct SMTP_PASSWORD" -ForegroundColor White
Write-Host "   2. Restart StickyNote application service" -ForegroundColor White
Write-Host "   3. Test user registration (sends verification email)" -ForegroundColor White
Write-Host "   4. Check application logs if emails don't arrive" -ForegroundColor White
Write-Host ""

Write-Host "🔍 Verification Commands:" -ForegroundColor Cyan
Write-Host "   # Check service account" -ForegroundColor Gray
Write-Host "   Get-ADUser stickmynote_svc -Properties *" -ForegroundColor Gray
Write-Host ""
Write-Host "   # Check mailbox" -ForegroundColor Gray
Write-Host "   Get-Mailbox stickmynote_svc" -ForegroundColor Gray
Write-Host ""
Write-Host "   # Check receive connectors" -ForegroundColor Gray
Write-Host "   Get-ReceiveConnector | Where-Object { `$_.RemoteIPRanges -contains '$WebServerIP' }" -ForegroundColor Gray
Write-Host ""

Write-Host "═══════════════════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "   SETUP COMPLETE!" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""

# Save configuration
$saveConfig = Read-Host "Save configuration details to file? (yes/no)"
if ($saveConfig -eq "yes") {
    # Ensure directory exists
    $configDir = "C:\scripts"
    if (-not (Test-Path $configDir)) {
        New-Item -Path $configDir -ItemType Directory -Force | Out-Null
        Write-Host "   Created directory: $configDir" -ForegroundColor White
    }
    
    $configFile = Join-Path $configDir "StickyNote-SMTP-Config.txt"
    
    $configContent = @"
# ============================================================================
# StickyNote Exchange SMTP Configuration
# Generated: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
# Server: $hostname
# ============================================================================

SMTP Configuration for .env.local on Web Server:
-------------------------------------------------
SMTP_HOST=192.168.50.40
SMTP_PORT=587
SMTP_SECURE=true
SMTP_USER=stickmynote@$Domain
SMTP_PASSWORD=[password you entered during setup]
SMTP_FROM=noreply@$Domain

Service Account Details:
------------------------
Username: stickmynote_svc
UPN: stickmynote@$Domain
Email: noreply@$Domain
Domain: $Domain

Receive Connector:
------------------
Name: $connectorName
Allowed IP: $WebServerIP
Port: 587
Auth: TLS + BasicAuth
TLS Required: Yes

Testing from PowerShell:
------------------------
`$credential = Get-Credential -UserName "stickmynote@$Domain"
Send-MailMessage ``
  -To "test@$Domain" ``
  -From "noreply@$Domain" ``
  -Subject "Test" ``
  -Body "Test email" ``
  -SmtpServer "192.168.50.40" ``
  -Port 587 ``
  -UseSsl ``
  -Credential `$credential

Troubleshooting:
----------------
1. Check Exchange transport logs
2. Verify firewall allows port 587
3. Check service account is not locked
4. Verify credentials are correct in .env.local
5. Check application logs on web server

# ============================================================================
"@
    
    $configContent | Out-File -FilePath $configFile -Encoding UTF8
    Write-Host "✅ Configuration saved to: $configFile" -ForegroundColor Green
    Write-Host ""
}

Write-Host "Press any key to exit..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

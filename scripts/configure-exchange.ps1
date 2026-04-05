# ============================================================================
# Exchange Server Configuration for StickyNote
# Server: HOL-DC4-EXCH (192.168.50.40)
# ============================================================================

Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host "EXCHANGE SERVER CONFIGURATION FOR STICKYNOTE" -ForegroundColor Cyan
Write-Host "Server: HOL-DC4-EXCH (192.168.50.40)" -ForegroundColor Cyan
Write-Host "============================================================================`n" -ForegroundColor Cyan

# Verify we're running on the Exchange server
$hostname = $env:COMPUTERNAME
Write-Host "Current Computer: $hostname" -ForegroundColor Yellow

if ($hostname -ne "HOL-DC4-EXCH") {
    Write-Host "WARNING: This script should be run on HOL-DC4-EXCH (192.168.50.40)" -ForegroundColor Red
    $continue = Read-Host "Continue anyway? (y/n)"
    if ($continue -ne 'y') {
        exit
    }
}

Write-Host "`n============================================================================"
Write-Host "OPTION 1: AUTHENTICATED SMTP (RECOMMENDED)" -ForegroundColor Green
Write-Host "============================================================================`n"

# ============================================================================
# STEP 1: Create Service Account
# ============================================================================
Write-Host "`n[STEP 1] Creating Service Account..." -ForegroundColor Cyan
Write-Host "Account Name: stickmynote_svc" -ForegroundColor Yellow
Write-Host "UPN: stickmynote@stickmynote.com" -ForegroundColor Yellow

$createAccount = Read-Host "`nCreate service account? (y/n)"

if ($createAccount -eq 'y') {
    $password = Read-Host -AsSecureString "Enter password for service account"
    
    try {
        New-ADUser -Name "StickyNote Service" `
            -SamAccountName "stickmynote_svc" `
            -UserPrincipalName "stickmynote@stickmynote.com" `
            -AccountPassword $password `
            -Enabled $true `
            -PasswordNeverExpires $true `
            -CannotChangePassword $true `
            -Description "Service account for StickyNote application email relay"
        
        Write-Host "✅ Service account created successfully" -ForegroundColor Green
    } catch {
        Write-Host "❌ Error creating service account: $_" -ForegroundColor Red
        Write-Host "Account may already exist" -ForegroundColor Yellow
    }
}

# ============================================================================
# STEP 2: Create Mailbox
# ============================================================================
Write-Host "`n[STEP 2] Creating Mailbox..." -ForegroundColor Cyan

$createMailbox = Read-Host "Enable mailbox for stickmynote_svc? (y/n)"

if ($createMailbox -eq 'y') {
    try {
        Enable-Mailbox -Identity "stickmynote_svc" -Alias "stickmynote" -ErrorAction Stop
        Write-Host "✅ Mailbox enabled" -ForegroundColor Green
        
        Start-Sleep -Seconds 2
        
        Set-Mailbox -Identity "stickmynote_svc" `
            -EmailAddresses "SMTP:noreply@stickmynote.com" `
            -ErrorAction Stop
        
        Write-Host "✅ Email address set to noreply@stickmynote.com" -ForegroundColor Green
    } catch {
        Write-Host "❌ Error creating mailbox: $_" -ForegroundColor Red
    }
}

# ============================================================================
# STEP 3: Grant Send Permissions
# ============================================================================
Write-Host "`n[STEP 3] Granting Send Permissions..." -ForegroundColor Cyan

$grantPerms = Read-Host "Grant send-as permissions? (y/n)"

if ($grantPerms -eq 'y') {
    try {
        Add-ADPermission -Identity "stickmynote_svc" `
            -User "stickmynote_svc" `
            -ExtendedRights "Send-As" `
            -ErrorAction Stop
        
        Write-Host "✅ Send-As permissions granted" -ForegroundColor Green
    } catch {
        Write-Host "⚠️  Permission may already exist or error occurred: $_" -ForegroundColor Yellow
    }
}

# ============================================================================
# STEP 4: Configure Receive Connector (if needed)
# ============================================================================
Write-Host "`n[STEP 4] Checking Receive Connector..." -ForegroundColor Cyan

$configureConnector = Read-Host "Configure receive connector for web server (192.168.50.20)? (y/n)"

if ($configureConnector -eq 'y') {
    try {
        $connectorName = "StickyNote Web Server Relay"
        
        # Check if connector exists
        $existingConnector = Get-ReceiveConnector -Identity $connectorName -ErrorAction SilentlyContinue
        
        if ($existingConnector) {
            Write-Host "Connector already exists, updating..." -ForegroundColor Yellow
            Set-ReceiveConnector -Identity $connectorName `
                -RemoteIPRanges @{Add="192.168.50.20"} `
                -AuthMechanism TLS, BasicAuth, BasicAuthRequireTLS `
                -PermissionGroups ExchangeUsers `
                -RequireTLS $true
        } else {
            Write-Host "Creating new receive connector..." -ForegroundColor Yellow
            New-ReceiveConnector -Name $connectorName `
                -TransportRole FrontendTransport `
                -Bindings "192.168.50.40:587" `
                -RemoteIPRanges "192.168.50.20" `
                -AuthMechanism TLS, BasicAuth, BasicAuthRequireTLS `
                -PermissionGroups ExchangeUsers `
                -RequireTLS $true
        }
        
        Write-Host "✅ Receive connector configured" -ForegroundColor Green
    } catch {
        Write-Host "❌ Error configuring connector: $_" -ForegroundColor Red
    }
}

# ============================================================================
# STEP 5: Test SMTP Connection
# ============================================================================
Write-Host "`n[STEP 5] Test SMTP Connection..." -ForegroundColor Cyan

$testEmail = Read-Host "Send test email? (y/n)"

if ($testEmail -eq 'y') {
    $toEmail = Read-Host "Enter recipient email address"
    $username = Read-Host "Enter username (e.g., stickmynote@stickmynote.com)"
    $password = Read-Host -AsSecureString "Enter password"
    
    $credential = New-Object System.Management.Automation.PSCredential($username, $password)
    
    try {
        Send-MailMessage `
            -To $toEmail `
            -From "noreply@stickmynote.com" `
            -Subject "Test Email from StickyNote" `
            -Body "This is a test email from the StickyNote application. If you receive this, SMTP is configured correctly." `
            -SmtpServer "192.168.50.40" `
            -Port 587 `
            -UseSsl `
            -Credential $credential
        
        Write-Host "✅ Test email sent successfully!" -ForegroundColor Green
        Write-Host "Check $toEmail for the test message" -ForegroundColor Yellow
    } catch {
        Write-Host "❌ Error sending test email: $_" -ForegroundColor Red
    }
}

# ============================================================================
# SUMMARY
# ============================================================================
Write-Host "`n============================================================================"
Write-Host "CONFIGURATION SUMMARY" -ForegroundColor Green
Write-Host "============================================================================`n"

Write-Host "📧 SMTP Configuration for .env file:" -ForegroundColor Cyan
Write-Host "   SMTP_HOST=192.168.50.40" -ForegroundColor White
Write-Host "   SMTP_PORT=587" -ForegroundColor White
Write-Host "   SMTP_SECURE=true" -ForegroundColor White
Write-Host "   SMTP_USER=stickmynote@stickmynote.com" -ForegroundColor White
Write-Host "   SMTP_PASSWORD=[service account password]" -ForegroundColor White
Write-Host "   SMTP_FROM=noreply@stickmynote.com" -ForegroundColor White

Write-Host "`n📝 Next Steps:" -ForegroundColor Cyan
Write-Host "   1. Update .env.local on Web Server (HOL-DC2-IIS) with SMTP settings above" -ForegroundColor White
Write-Host "   2. Remove or comment out RESEND_API_KEY if switching to Exchange" -ForegroundColor White
Write-Host "   3. Restart the StickyNote application" -ForegroundColor White
Write-Host "   4. Test user registration to verify email delivery" -ForegroundColor White

Write-Host "`n============================================================================`n"

# Save credentials securely
$saveConfig = Read-Host "Save configuration to file? (y/n)"
if ($saveConfig -eq 'y') {
    $config = @"
# ============================================================================
# StickyNote Exchange Server Configuration
# Generated: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
# ============================================================================

SMTP_HOST=192.168.50.40
SMTP_PORT=587
SMTP_SECURE=true
SMTP_USER=stickmynote@stickmynote.com
SMTP_PASSWORD=$($env:SMTP_PASSWORD)
SMTP_FROM=noreply@stickmynote.com

# To use in .env.local, copy these values and remove the RESEND settings
"@
    
    $config | Out-File -FilePath "C:\StickyNote-SMTP-Config.txt" -Encoding UTF8
    Write-Host "✅ Configuration saved to C:\StickyNote-SMTP-Config.txt" -ForegroundColor Green
}

Write-Host "Configuration complete!" -ForegroundColor Green

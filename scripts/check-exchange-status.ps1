# ============================================================================
# Check Exchange Server Status for StickyNote
# ============================================================================

Write-Host "`n============================================================================" -ForegroundColor Cyan
Write-Host "EXCHANGE SERVER STATUS CHECK" -ForegroundColor Cyan
Write-Host "============================================================================`n" -ForegroundColor Cyan

# Check if running on Exchange server
$hostname = $env:COMPUTERNAME
Write-Host "Current Computer: $hostname`n" -ForegroundColor Yellow

# ============================================================================
# Check 1: Service Account
# ============================================================================
Write-Host "[CHECK 1] Service Account Status..." -ForegroundColor Cyan

try {
    $user = Get-ADUser -Identity "stickmynote_svc" -Properties * -ErrorAction Stop
    Write-Host "✅ Service account exists" -ForegroundColor Green
    Write-Host "   Name: $($user.Name)" -ForegroundColor White
    Write-Host "   UPN: $($user.UserPrincipalName)" -ForegroundColor White
    Write-Host "   Enabled: $($user.Enabled)" -ForegroundColor White
    Write-Host "   Password Never Expires: $($user.PasswordNeverExpires)" -ForegroundColor White
} catch {
    Write-Host "❌ Service account 'stickmynote_svc' not found" -ForegroundColor Red
    Write-Host "   Run configure-exchange.ps1 to create it" -ForegroundColor Yellow
}

# ============================================================================
# Check 2: Mailbox
# ============================================================================
Write-Host "`n[CHECK 2] Mailbox Status..." -ForegroundColor Cyan

try {
    $mailbox = Get-Mailbox -Identity "stickmynote_svc" -ErrorAction Stop
    Write-Host "✅ Mailbox enabled" -ForegroundColor Green
    Write-Host "   Primary SMTP: $($mailbox.PrimarySmtpAddress)" -ForegroundColor White
    Write-Host "   Alias: $($mailbox.Alias)" -ForegroundColor White
    Write-Host "   Email Addresses: $($mailbox.EmailAddresses -join ', ')" -ForegroundColor White
} catch {
    Write-Host "❌ Mailbox not found for stickmynote_svc" -ForegroundColor Red
    Write-Host "   Run configure-exchange.ps1 to enable it" -ForegroundColor Yellow
}

# ============================================================================
# Check 3: Receive Connectors
# ============================================================================
Write-Host "`n[CHECK 3] Receive Connectors..." -ForegroundColor Cyan

try {
    $connectors = Get-ReceiveConnector | Where-Object { 
        $_.RemoteIPRanges -contains "192.168.50.20" -or 
        $_.Name -like "*StickyNote*" 
    }
    
    if ($connectors) {
        Write-Host "✅ Receive connectors configured:" -ForegroundColor Green
        foreach ($conn in $connectors) {
            Write-Host "   Name: $($conn.Name)" -ForegroundColor White
            Write-Host "   Bindings: $($conn.Bindings -join ', ')" -ForegroundColor White
            Write-Host "   Remote IPs: $($conn.RemoteIPRanges -join ', ')" -ForegroundColor White
            Write-Host "   Auth Methods: $($conn.AuthMechanism -join ', ')" -ForegroundColor White
            Write-Host ""
        }
    } else {
        Write-Host "⚠️  No specific connector found for web server (192.168.50.20)" -ForegroundColor Yellow
        
        $defaultConnector = Get-ReceiveConnector | Where-Object { $_.Name -like "*Default*" } | Select-Object -First 1
        if ($defaultConnector) {
            Write-Host "   Default connector exists:" -ForegroundColor White
            Write-Host "   Name: $($defaultConnector.Name)" -ForegroundColor White
            Write-Host "   Remote IPs: $($defaultConnector.RemoteIPRanges -join ', ')" -ForegroundColor White
        }
    }
} catch {
    Write-Host "❌ Error checking receive connectors: $_" -ForegroundColor Red
}

# ============================================================================
# Check 4: Test SMTP Connectivity
# ============================================================================
Write-Host "`n[CHECK 4] SMTP Connectivity Test..." -ForegroundColor Cyan

$testConnection = Read-Host "Test SMTP connection from this machine? (y/n)"

if ($testConnection -eq 'y') {
    try {
        $connection = Test-NetConnection -ComputerName "192.168.50.40" -Port 587
        
        if ($connection.TcpTestSucceeded) {
            Write-Host "✅ Port 587 is accessible" -ForegroundColor Green
        } else {
            Write-Host "❌ Port 587 is not accessible" -ForegroundColor Red
        }
    } catch {
        Write-Host "❌ Error testing connection: $_" -ForegroundColor Red
    }
    
    # Test port 25
    try {
        $connection25 = Test-NetConnection -ComputerName "192.168.50.40" -Port 25
        
        if ($connection25.TcpTestSucceeded) {
            Write-Host "✅ Port 25 is accessible" -ForegroundColor Green
        } else {
            Write-Host "❌ Port 25 is not accessible" -ForegroundColor Red
        }
    } catch {
        Write-Host "❌ Error testing connection: $_" -ForegroundColor Red
    }
}

# ============================================================================
# SUMMARY
# ============================================================================
Write-Host "`n============================================================================"
Write-Host "SUMMARY" -ForegroundColor Green
Write-Host "============================================================================`n"

Write-Host "Configuration Status:" -ForegroundColor Cyan
if ($user) { Write-Host "   ✅ Service Account" -ForegroundColor Green } else { Write-Host "   ❌ Service Account" -ForegroundColor Red }
if ($mailbox) { Write-Host "   ✅ Mailbox" -ForegroundColor Green } else { Write-Host "   ❌ Mailbox" -ForegroundColor Red }
if ($connectors) { Write-Host "   ✅ Receive Connector" -ForegroundColor Green } else { Write-Host "   ⚠️  Receive Connector" -ForegroundColor Yellow }

Write-Host "`nNext Steps:" -ForegroundColor Cyan
if (-not $user -or -not $mailbox) {
    Write-Host "   1. Run configure-exchange.ps1 to complete setup" -ForegroundColor White
} else {
    Write-Host "   1. Update .env.local with SMTP settings" -ForegroundColor White
    Write-Host "   2. Test email delivery from application" -ForegroundColor White
}

Write-Host "`n============================================================================`n"

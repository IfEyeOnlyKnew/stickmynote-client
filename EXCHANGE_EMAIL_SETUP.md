# Exchange Server Email Configuration Guide

## Current Status
You mentioned you started Exchange configuration but didn't finish. This guide will help you complete it.

## Quick Start

### Step 1: Check Current Status
Run this on the Exchange Server (HOL-DC4-EXCH):
```powershell
cd C:\stick-my-note-dev\stickmynote-client-install\scripts
.\check-exchange-status.ps1
```

This will show you:
- ✅ What's already configured
- ❌ What's missing
- Next steps to complete

### Step 2: Complete Exchange Configuration
Run this on the Exchange Server (HOL-DC4-EXCH):
```powershell
cd C:\stick-my-note-dev\stickmynote-client-install\scripts
.\configure-exchange.ps1
```

The script will:
1. Create service account (stickmynote_svc)
2. Enable mailbox for the service account
3. Set email address (noreply@stickmynote.com)
4. Configure SMTP receive connector
5. Test email delivery

### Step 3: Update Application Configuration

After Exchange is configured, update your `.env.local` file:

**Option A: Use Exchange SMTP (Recommended for internal network)**
```bash
# Comment out Resend
# RESEND_API_KEY=...
# RESEND_FROM_EMAIL=...

# Add Exchange SMTP
SMTP_HOST=192.168.50.40
SMTP_PORT=587
SMTP_SECURE=true
SMTP_USER=stickmynote@stickmynote.com
SMTP_PASSWORD=[your_service_account_password]
SMTP_FROM=noreply@stickmynote.com
```

**Option B: Keep Resend (Current setup)**
- Resend is already configured and working
- Good for external email delivery
- No changes needed

## What You Currently Have

From your `.env` file:
- ✅ Database configured (PostgreSQL)
- ✅ Resend API configured (email service)
- ⚠️ Exchange not yet integrated

## Decision: Exchange vs Resend

### Use Exchange SMTP if:
- All emails stay within your domain
- You want full control over email server
- No external email service costs
- Users are on internal network

### Keep Resend if:
- Need reliable external email delivery
- Want email analytics/tracking
- Don't want to manage Exchange complexity
- Already working well

## Testing Email After Configuration

### Test from PowerShell:
```powershell
# On Exchange or Web Server
Send-MailMessage `
  -To "yourname@stickmynote.com" `
  -From "noreply@stickmynote.com" `
  -Subject "Test from StickyNote" `
  -Body "Email is working!" `
  -SmtpServer "192.168.50.40" `
  -Port 587 `
  -UseSsl `
  -Credential (Get-Credential)
```

### Test from Application:
1. Start the application
2. Try user registration (sends verification email)
3. Check inbox for email
4. Check application logs for errors

## Troubleshooting

### If emails don't send:
1. Check Exchange receive connector: `Get-ReceiveConnector`
2. Check mailbox exists: `Get-Mailbox stickmynote_svc`
3. Check firewall port 587: `Test-NetConnection 192.168.50.40 -Port 587`
4. Check application logs

### Common Issues:
- **Authentication failed**: Wrong username/password in .env.local
- **Connection refused**: Firewall blocking port 587
- **Relay denied**: Web server IP not in receive connector
- **TLS error**: Certificate issues (use SMTP_SECURE=false for testing)

## Files Created

1. `scripts/configure-exchange.ps1` - Complete Exchange setup
2. `scripts/check-exchange-status.ps1` - Check current configuration
3. This guide - `EXCHANGE_EMAIL_SETUP.md`

## Next Steps

1. **Check Status**: Run `check-exchange-status.ps1` on HOL-DC4-EXCH
2. **Complete Setup**: Run `configure-exchange.ps1` if needed
3. **Update .env.local**: Add SMTP settings (or keep Resend)
4. **Test**: Send test email
5. **Verify**: Test from application

## Need Help?

The scripts are interactive and will guide you through each step. Just run them and answer the prompts!

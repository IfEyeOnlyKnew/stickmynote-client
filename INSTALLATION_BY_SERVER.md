# Installation Guide - By Server

**Your Stick My Note Infrastructure:**
- Domain: `stickmynote.com`
- Network: `192.168.50.0/24`

---

## Overview of Your Servers

| Server | Computer Name | IP Address | Purpose | Software Needed |
|--------|--------------|------------|---------|-----------------|
| **Domain Controller** | WIN-R0HEEUG88NH | 192.168.50.11 | Active Directory | N/A (existing) |
| **Web Server** | HOL-DC2-IIS | 192.168.50.20 | Runs Stick My Note app | Node.js 20 LTS, NSSM, App files |
| **PostgreSQL Server** | HOL-DC3-PGSQL | 192.168.50.30 | Database storage | PostgreSQL 15, pgAdmin 4 |
| **Exchange Server** | HOL-DC4-EXCH | 192.168.50.40 | Email delivery | Existing Exchange (configure relay) |
| **Redis Server** | HOL-DC5-REDIS | 192.168.50.50 | Caching & rate limiting | Memurai |

---

## SERVER 1: PostgreSQL Server (HOL-DC3-PGSQL - 192.168.50.30)

### What You're Installing
- PostgreSQL 15 database
- Database for Stick My Note application
- Automated backup scripts

### Installation Steps

#### Step 1: Install PostgreSQL 15
\`\`\`powershell
# Computer: HOL-DC3-PGSQL
# Download installer from: https://www.postgresql.org/download/windows/
# Run the installer with these settings:
#   - Port: 5432
#   - Password: Choose a STRONG password (save it!)
#   - Locale: English, United States
#   - Install pgAdmin 4: YES
# Stack Builder: NOT REQUIRED (skip it)
\`\`\`

#### Step 2: Allow Network Connections
\`\`\`powershell
# Edit: C:\Program Files\PostgreSQL\15\data\postgresql.conf
# Find line: listen_addresses = 'localhost'
# Change to: listen_addresses = '*'

# Edit: C:\Program Files\PostgreSQL\15\data\pg_hba.conf
# Add these lines at the END of the file:
# Allow Web Server (HOL-DC2-IIS) - MOST SECURE
host    all             all             192.168.50.20/32       scram-sha-256
# Allow entire subnet (if needed for admin access)
host    all             all             192.168.50.0/24        scram-sha-256

# Restart PostgreSQL
Restart-Service postgresql-x64-15
\`\`\`

#### Step 3: Open Firewall
\`\`\`powershell
# Allow only Web Server
New-NetFirewallRule -DisplayName "PostgreSQL for StickyNote" `
  -Direction Inbound `
  -LocalPort 5432 `
  -Protocol TCP `
  -Action Allow `
  -RemoteAddress 192.168.50.20

# Verify rule created
Get-NetFirewallRule -DisplayName "PostgreSQL for StickyNote"
\`\`\`

#### Step 4: Create Database and User
\`\`\`sql
-- Open pgAdmin 4 (Start Menu → PostgreSQL 15 → pgAdmin 4)
-- Connect to PostgreSQL server
-- Tools → Query Tool
-- Run this SQL:

CREATE DATABASE stickmynote;
CREATE USER stickmynote_user WITH ENCRYPTED PASSWORD 'YOUR_STRONG_PASSWORD_HERE';
GRANT ALL PRIVILEGES ON DATABASE stickmynote TO stickmynote_user;
ALTER DATABASE stickmynote OWNER TO stickmynote_user;

-- Connect to the stickmynote database
\c stickmynote

-- Grant schema permissions
GRANT ALL ON SCHEMA public TO stickmynote_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO stickmynote_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO stickmynote_user;
\`\`\`

#### Step 5: Copy Migration Scripts to Database Server
\`\`\`powershell
# Create migration directory
New-Item -Path "C:\DatabaseMigrations" -ItemType Directory -Force

# Copy these 9 migration files from the application package:
# - 01-create-core-tables.sql
# - 02-create-sticks-tables.sql
# - 03-create-social-tables.sql
# - 04-create-calstick-tables.sql
# - 05-create-teams-projects-tables.sql
# - 06-create-notifications-activity-tables.sql
# - 07-create-analytics-system-tables.sql
# - 08-create-tags-search-ai-tables.sql
# - 02-create-server-config-table.sql

# You can copy from the Web Server after deployment, or from your build server
# Example: Copy from network share
Copy-Item -Path "\\fileserver\StickyNote\scripts\windows-server\*" `
  -Destination "C:\DatabaseMigrations\" `
  -Filter "*.sql"
\`\`\`

#### Step 6: Run Migration Scripts in Order
\`\`\`powershell
# Open PowerShell as Administrator
cd C:\DatabaseMigrations

# Run each migration in sequence
# When prompted for password, enter the stickmynote_user password you created

Write-Host "Running migration 1 of 9: Core Tables..."
& "C:\Program Files\PostgreSQL\15\bin\psql.exe" -U stickmynote_user -h localhost -d stickmynote -f 01-create-core-tables.sql

Write-Host "Running migration 2 of 9: Sticks Tables..."
& "C:\Program Files\PostgreSQL\15\bin\psql.exe" -U stickmynote_user -h localhost -d stickmynote -f 02-create-sticks-tables.sql

Write-Host "Running migration 3 of 9: Social Tables..."
& "C:\Program Files\PostgreSQL\15\bin\psql.exe" -U stickmynote_user -h localhost -d stickmynote -f 03-create-social-tables.sql

Write-Host "Running migration 4 of 9: CalStick Tables..."
& "C:\Program Files\PostgreSQL\15\bin\psql.exe" -U stickmynote_user -h localhost -d stickmynote -f 04-create-calstick-tables.sql

Write-Host "Running migration 5 of 9: Teams & Projects Tables..."
& "C:\Program Files\PostgreSQL\15\bin\psql.exe" -U stickmynote_user -h localhost -d stickmynote -f 05-create-teams-projects-tables.sql

Write-Host "Running migration 6 of 9: Notifications & Activity Tables..."
& "C:\Program Files\PostgreSQL\15\bin\psql.exe" -U stickmynote_user -h localhost -d stickmynote -f 06-create-notifications-activity-tables.sql

Write-Host "Running migration 7 of 9: Analytics & System Tables..."
& "C:\Program Files\PostgreSQL\15\bin\psql.exe" -U stickmynote_user -h localhost -d stickmynote -f 07-create-analytics-system-tables.sql

Write-Host "Running migration 8 of 9: Tags, Search & AI Tables..."
& "C:\Program Files\PostgreSQL\15\bin\psql.exe" -U stickmynote_user -h localhost -d stickmynote -f 08-create-tags-search-ai-tables.sql

Write-Host "Running migration 9 of 9: Server Configuration Table..."
& "C:\Program Files\PostgreSQL\15\bin\psql.exe" -U stickmynote_user -h localhost -d stickmynote -f 02-create-server-config-table.sql

Write-Host "All migrations complete!"
\`\`\`

**OR create a master script to run them all:**

Create `C:\DatabaseMigrations\run-all-migrations.ps1`:
\`\`\`powershell
$psqlPath = "C:\Program Files\PostgreSQL\15\bin\psql.exe"
$dbUser = "stickmynote_user"
$dbHost = "localhost"
$dbName = "stickmynote"

$migrations = @(
    "01-create-core-tables.sql",
    "02-create-sticks-tables.sql",
    "03-create-social-tables.sql",
    "04-create-calstick-tables.sql",
    "05-create-teams-projects-tables.sql",
    "06-create-notifications-activity-tables.sql",
    "07-create-analytics-system-tables.sql",
    "08-create-tags-search-ai-tables.sql",
    "02-create-server-config-table.sql"
)

$i = 1
foreach ($migration in $migrations) {
    Write-Host "Running migration $i of $($migrations.Count): $migration" -ForegroundColor Cyan
    & $psqlPath -U $dbUser -h $dbHost -d $dbName -f $migration
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Migration $migration failed!" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "✓ Migration $migration completed successfully" -ForegroundColor Green
    $i++
}

Write-Host "`n✓ All migrations completed successfully!" -ForegroundColor Green
Write-Host "Total tables created: 96" -ForegroundColor Cyan
\`\`\`

Then run:
\`\`\`powershell
cd C:\DatabaseMigrations
.\run-all-migrations.ps1
\`\`\`

#### Step 7: Verify All Tables Were Created
\`\`\`powershell
# Check table count
& "C:\Program Files\PostgreSQL\15\bin\psql.exe" -U stickmynote_user -h localhost -d stickmynote -c "SELECT COUNT(*) as total_tables FROM information_schema.tables WHERE table_schema = 'public';"

# Should show: 96 tables

# List all tables
& "C:\Program Files\PostgreSQL\15\bin\psql.exe" -U stickmynote_user -h localhost -d stickmynote -c "\dt"
\`\`\`

#### Step 8: Setup Automated Backups
\`\`\`powershell
# Create directory for backups
mkdir D:\Backups\StickyNote

# Create backup script
New-Item -Path "C:\Scripts\backup-stickmynote.ps1" -ItemType File -Force
\`\`\`

Copy this into `C:\Scripts\backup-stickmynote.ps1`:
\`\`\`powershell
$backupDir = "D:\Backups\StickyNote"
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupFile = "$backupDir\stickmynote_$timestamp.backup"

& "C:\Program Files\PostgreSQL\15\bin\pg_dump.exe" `
  -U stickmynote_user `
  -h localhost `
  -d stickmynote `
  -F c `
  -f $backupFile

# Delete backups older than 30 days
Get-ChildItem $backupDir -Filter "*.backup" | 
  Where-Object {$_.LastWriteTime -lt (Get-Date).AddDays(-30)} |
  Remove-Item
\`\`\`

\`\`\`powershell
# Schedule daily backups at 2 AM
$action = New-ScheduledTaskAction -Execute "PowerShell.exe" `
  -Argument "-ExecutionPolicy Bypass -File C:\Scripts\backup-stickmynote.ps1"
$trigger = New-ScheduledTaskTrigger -Daily -At 2:00AM
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount
Register-ScheduledTask -Action $action -Trigger $trigger -Principal $principal `
  -TaskName "StickyNote Database Backup" `
  -Description "Daily backup of StickyNote database"
\`\`\`

### Test It Works
\`\`\`powershell
# From this server, test connection:
& "C:\Program Files\PostgreSQL\15\bin\psql.exe" -U stickmynote_user -h localhost -d stickmynote -c "SELECT version();"
# Should show PostgreSQL version

# From Web Server (HOL-DC2-IIS), test connection:
Test-NetConnection -ComputerName HOL-DC3-PGSQL.stickmynote.com -Port 5432 -InformationLevel Detailed
# Should show 
ComputerName            : HOL-DC3-PGSQL.stickmynote.com
RemoteAddress           : 192.168.50.30
RemotePort              : 5432
NameResolutionResults   : 192.168.50.30
MatchingIPsecRules      : 
NetworkIsolationContext : Private Network
InterfaceAlias          : Ethernet
SourceAddress           : 192.168.50.20
NetRoute (NextHop)      : 0.0.0.0
TcpTestSucceeded        : True
\`\`\`

**SAVE THESE VALUES FOR LATER:**
- Database Host: `192.168.50.30`
- Database Port: `5432`
- Database Name: `stickmynote`
- Database User: `stickmynote_user`
- Database Password: `[the password you created]`

---

## SERVER 2: Redis Server (HOL-DC5-REDIS - 192.168.50.50)

### What You're Installing
- Memurai (Windows-native Redis-compatible cache server)
- Used for caching and rate limiting

### Installation Steps

#### Step 1: Download and Install Memurai

\`\`\`powershell
# Download Memurai from: https://www.memurai.com/get-memurai
# Choose: Memurai Developer Edition (Free) or Enterprise Edition

# Run the installer: Memurai-Setup-X.X.X.msi
# Installation path: C:\Program Files\Memurai

# The installer will automatically:
# - Install Memurai as a Windows Service
# - Create default configuration
# - Start the service
\`\`\`

#### Step 2: Configure Memurai for Production

\`\`\`powershell
# Stop the service to edit configuration
Stop-Service Memurai

# Edit configuration file
notepad "C:\Program Files\Memurai\memurai.conf"
\`\`\`

Add/modify these settings in `memurai.conf`:

\`\`\`conf
bind 0.0.0.0
port 6379
protected-mode yes


# Generate a secure password
Add-Type -AssemblyName System.Web
$password = [System.Web.Security.Membership]::GeneratePassword(32, 8)
Write-Host "Generated Redis Password: $password"
# SAVE THIS PASSWORD - You'll need it for the web server configuration

requirepass requirepass l3bLO#/O+D[|{#5fT5j0SgQ9o)HnfwJ*

# If need remove service
Remove-Service -Name "memurai"
sc.exe delete memurai # Run in PowerShell ISE 5.1

save 900 1
save 300 10
save 60 10000
appendonly yes
appendfilename "appendonly.aof"

maxmemory 4gb
maxmemory-policy allkeys-lru

loglevel notice
logfile "C:\\Program Files\\Memurai\\Logs\\memurai.log"

timeout 300
tcp-keepalive 60
\`\`\`

Save and restart the service:

\`\`\`powershell
Start-Service Memurai
Get-Service Memurai
# Should show "Running" status
\`\`\`

#### Step 3: Configure Windows Firewall

\`\`\`powershell
New-NetFirewallRule -DisplayName "Memurai for Stick My Note" `
  -Direction Inbound `
  -LocalPort 6379 `
  -Protocol TCP `
  -Action Allow `
  -RemoteAddress 192.168.50.20 `
  -Profile Domain,Private

# Verify firewall rule
Get-NetFirewallRule -DisplayName "Memurai for Stick My Note" | Format-List
\`\`\`

#### Step 4: Verify Memurai is Running

\`\`\`powershell
# Check service status
Get-Service Memurai | Format-Table -AutoSize

# Check if Memurai is listening
Test-NetConnection -ComputerName localhost -Port 6379

# Test with Memurai CLI
cd "C:\Program Files\Memurai"
.\memurai-cli.exe -a YOUR_STRONG_REDIS_PASSWORD_HERE ping
# Should return: PONG
\`\`\`

#### Step 5: Test Remote Connection from Web Server

From **HOL-DC2-IIS (Web Server - 192.168.50.20)**, test the connection:

\`\`\`powershell
# Test network connectivity
Test-NetConnection -ComputerName 192.168.50.50 -Port 6379

# If you have redis-cli installed on web server
redis-cli -h 192.168.50.50 -p 6379 -a YOUR_STRONG_REDIS_PASSWORD_HERE ping
# Should return: PONG
\`\`\`

### Configure Automatic Backups (Optional but Recommended)

\`\`\`powershell
# Create backup directory
New-Item -Path "C:\MemuraiBackups" -ItemType Directory

# Create backup script: C:\Scripts\backup-memurai.ps1
$backupDir = "C:\MemuraiBackups"
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$dumpFile = "C:\Program Files\Memurai\dump.rdb"

if (Test-Path $dumpFile) {
    Copy-Item $dumpFile "$backupDir\dump_$timestamp.rdb"
    
    # Keep only last 7 days of backups
    Get-ChildItem $backupDir -Filter "dump_*.rdb" |
        Where-Object {$_.LastWriteTime -lt (Get-Date).AddDays(-7)} |
        Remove-Item
}

# Schedule daily backup at 3:00 AM
$action = New-ScheduledTaskAction -Execute "PowerShell.exe" `
  -Argument "-File C:\Scripts\backup-memurai.ps1"
$trigger = New-ScheduledTaskTrigger -Daily -At 3:00AM
Register-ScheduledTask -Action $action -Trigger $trigger `
  -TaskName "Memurai Daily Backup" -Description "Backup Memurai database"
\`\`\`

### Monitor Memurai Health

\`\`\`powershell
# Check memory usage
cd "C:\Program Files\Memurai"
.\memurai-cli.exe -a YOUR_PASSWORD INFO memory

# Check connected clients
.\memurai-cli.exe -a YOUR_PASSWORD CLIENT LIST

# Check key count
.\memurai-cli.exe -a YOUR_PASSWORD DBSIZE

# Monitor real-time commands
.\memurai-cli.exe -a YOUR_PASSWORD MONITOR
\`\`\`

### Troubleshooting

**Service won't start:**
\`\`\`powershell
# Check event logs
Get-EventLog -LogName Application -Source Memurai -Newest 10

# Check Memurai log file
Get-Content "C:\Program Files\Memurai\Logs\memurai.log" -Tail 50
\`\`\`

**Cannot connect remotely:**
\`\`\`powershell
# Verify bind address in config
Get-Content "C:\Program Files\Memurai\memurai.conf" | Select-String "bind"

# Test from Redis server itself
.\memurai-cli.exe -h 192.168.50.50 -p 6379 -a YOUR_PASSWORD ping
\`\`\`

**High memory usage:**
\`\`\`powershell
# Check memory stats
.\memurai-cli.exe -a YOUR_PASSWORD INFO memory

# Flush cache if needed (WARNING: removes all data)
.\memurai-cli.exe -a YOUR_PASSWORD FLUSHALL
\`\`\`

### Test It Works
\`\`\`powershell
# Install redis-cli (comes with Memurai)
cd "C:\Program Files\Memurai"
.\memurai-cli.exe -h 127.0.0.1 -p 6379 -a YOUR_REDIS_PASSWORD_HERE ping
# Should return: PONG

# From Web Server (HOL-DC2-IIS), test:
.\memurai-cli.exe -h 192.168.50.50 -p 6379 -a YOUR_REDIS_PASSWORD_HERE ping
# Should return: PONG
\`\`\`

**SAVE THESE VALUES FOR WEB SERVER CONFIGURATION:**
- **Redis Host:** `192.168.50.50`
- **Redis Port:** `6379`
- **Redis Password:** `[the strong password you set in memurai.conf]`
- **Service Name:** `Memurai`

---

## SERVER 3: Exchange Server (HOL-DC4-EXCH - 192.168.50.40)

### What You're Configuring
- SMTP relay for the application to send emails
- Service account for authentication

### Configuration Steps

#### Option A: Authenticated SMTP (Recommended)

#### Step 1: Create Service Account
\`\`\`powershell
# On Domain Controller or Exchange Server
# Open Active Directory Users and Computers

# Or use PowerShell:
New-ADUser -Name "StickyNote Service" `
  -SamAccountName "stickmynote_svc" `
  -UserPrincipalName "stickmynote@yourdomain.com" `
  -AccountPassword (Read-Host -AsSecureString "Enter Password") `
  -Enabled $true `
  -PasswordNeverExpires $true `
  -Description "Service account for StickyNote application"
\`\`\`

#### Step 2: Create Mailbox
\`\`\`powershell
# On Exchange Server
Enable-Mailbox -Identity "stickmynote_svc" `
  -Alias "stickmynote"

# Set email address
Set-Mailbox -Identity "stickmynote_svc" `
  -EmailAddresses "SMTP:noreply@stickmynote.com"
\`\`\`

#### Step 3: Grant Send Permissions
\`\`\`powershell
# Allow service account to send as different users
Add-ADPermission -Identity "stickmynote_svc" `
  -User "stickmynote_svc" `
  -ExtendedRights "Send-As"
\`\`\`

#### Option B: Anonymous Relay (Less Secure)

#### Step 1: Configure Receive Connector
\`\`\`powershell
# On Exchange Server
Get-ReceiveConnector | Where-Object {$_.Name -like "*Default*"} | 
  Set-ReceiveConnector -RemoteIPRanges @{Add="192.168.50.20"} -PermissionGroups AnonymousUsers
\`\`\`

#### Step 2: Test SMTP
\`\`\`powershell
# From Web Server (HOL-DC2-IIS)
Send-MailMessage `
  -To "test@yourdomain.com" `
  -From "noreply@stickmynote.com" `
  -Subject "Test Email from StickyNote" `
  -Body "This is a test email" `
  -SmtpServer "192.168.50.40" `
  -Port 587 `
  -UseSsl `
  -Credential (Get-Credential)
# Use the service account credentials when prompted
\`\`\`

**SAVE THESE VALUES FOR LATER:**
- SMTP Host: `192.168.50.40` (or `mail.yourdomain.com`)
- SMTP Port: `587` (with TLS) or `25` (internal relay)
- SMTP Username: `stickmynote@yourdomain.com`
- SMTP Password: `[service account password]`
- From Email: `noreply@stickmynote.com`

---

## SERVER 4: Web Server (HOL-DC2-IIS - 192.168.50.20)

### What You're Installing
- Node.js runtime
- Stick My Note application
- Windows Service (using NSSM)

### Installation Steps

#### Step 1: Install Node.js 20 LTS
\`\`\`powershell
# Computer: HOL-DC2-IIS
# Download from: https://nodejs.org/
# Choose: 20.x.x LTS (Long Term Support)
# Run installer - use default settings
# Make sure "Add to PATH" is checked

# Restart PowerShell, then verify:
node --version
# Should show: v20.x.x

npm --version
# Should show: 10.x.x
\`\`\`

#### Step 2: Install NSSM (Service Manager)
\`\`\`powershell
# Download from: https://nssm.cc/download
# Extract to: C:\Tools\nssm

# Add to system PATH
[Environment]::SetEnvironmentVariable(
  "Path",
  $env:Path + ";C:\Tools\nssm\win64",
  [EnvironmentVariableTarget]::Machine
)

# Restart PowerShell, then verify:
nssm --version
\`\`\`

#### Step 3: Deploy Application Files
\`\`\`powershell
# Create application directory
New-Item -Path "C:\StickyNote" -ItemType Directory -Force

# Copy application files to C:\StickyNote
# You can copy from a network share, USB drive, or clone from Git

# Example: Copy from network share
Copy-Item -Path "\\fileserver\Applications\StickyNote\*" `
  -Destination "C:\StickyNote" `
  -Recurse -Force

# OR: Clone from Git
cd C:\
git clone https://your-git-repo-url.git StickyNote
\`\`\`

#### Step 4: Install Application Dependencies
\`\`\`powershell
cd C:\StickyNote
npm install --production

# This will take several minutes - be patient!
\`\`\`

#### Step 5: Create Directories
\`\`\`powershell
# Create upload and log directories
New-Item -Path "C:\StickyNote\uploads" -ItemType Directory -Force
New-Item -Path "C:\StickyNote\uploads\avatars" -ItemType Directory -Force
New-Item -Path "C:\StickyNote\uploads\images" -ItemType Directory -Force
New-Item -Path "C:\StickyNote\uploads\documents" -ItemType Directory -Force
New-Item -Path "C:\StickyNote\logs" -ItemType Directory -Force

# Set permissions for NetworkService account
icacls "C:\StickyNote\uploads" /grant "NetworkService:(OI)(CI)M" /T
icacls "C:\StickyNote\logs" /grant "NetworkService:(OI)(CI)M" /T
\`\`\`

#### Step 6: Create Environment Configuration
\`\`\`powershell
# Create .env.production file
New-Item -Path "C:\StickyNote\.env.production" -ItemType File -Force
\`\`\`

Edit `C:\StickyNote\.env.production` with these values (use info from other servers):
\`\`\`env
# Deployment
NODE_ENV=production
DEPLOYMENT_MODE=windows_service

# Database (FROM POSTGRESQL SERVER)
DATABASE_URL=postgresql://stickmynote_user:YOUR_DB_PASSWORD@192.168.50.30:5432/stickmynote
POSTGRES_HOST=192.168.50.30
POSTGRES_PORT=5432
POSTGRES_DATABASE=stickmynote
POSTGRES_USER=stickmynote_user
POSTGRES_PASSWORD=YOUR_DB_PASSWORD_HERE

# Redis (FROM REDIS SERVER)
REDIS_URL=redis://:YOUR_REDIS_PASSWORD@192.168.50.50:6379
REDIS_HOST=192.168.50.50
REDIS_PORT=6379
REDIS_PASSWORD=YOUR_REDIS_PASSWORD_HERE
REDIS_DATABASE=0

# Email (FROM EXCHANGE SERVER)
SMTP_HOST=192.168.50.40
SMTP_PORT=587
SMTP_USE_TLS=true
SMTP_USER=stickmynote@yourdomain.com
SMTP_PASSWORD=YOUR_EXCHANGE_PASSWORD_HERE
SMTP_FROM_EMAIL=noreply@stickmynote.com
SMTP_FROM_NAME=Stick My Note

# Application
NEXT_PUBLIC_SITE_URL=https://www.stickmynote.com
APP_NAME=Stick My Note
PORT=3000

# File Storage
UPLOAD_DIR=C:\StickyNote\uploads
MAX_FILE_SIZE_MB=10

# Security (generate random strings)
CSRF_SECRET=GENERATE_RANDOM_32_CHARS_HERE
JWT_SECRET=GENERATE_RANDOM_32_CHARS_HERE
ENCRYPTION_KEY=GENERATE_RANDOM_32_CHARS_HERE
\`\`\`

To generate random secrets:
\`\`\`powershell
# Run this 3 times to get 3 different secrets
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | ForEach-Object {[char]$_})
\`\`\`

#### Step 7: Install as Windows Service
\`\`\`powershell
# Run the installation script
cd C:\StickyNote\windows-service
.\install-service.ps1
\`\`\`

**OR manually install:**
\`\`\`powershell
nssm install StickyNoteService "C:\Program Files\nodejs\node.exe"
nssm set StickyNoteService AppParameters "C:\StickyNote\server.js"
nssm set StickyNoteService AppDirectory "C:\StickyNote"
nssm set StickyNoteService DisplayName "Stick My Note"
nssm set StickyNoteService Description "Stick My Note Application Server"
nssm set StickyNoteService Start SERVICE_AUTO_START
nssm set StickyNoteService ObjectName "NetworkService"
nssm set StickyNoteService AppStdout "C:\StickyNote\logs\service-output.log"
nssm set StickyNoteService AppStderr "C:\StickyNote\logs\service-error.log"
nssm set StickyNoteService AppRotateFiles 1
nssm set StickyNoteService AppRotateOnline 1
nssm set StickyNoteService AppRotateBytes 10485760

# Start the service
nssm start StickyNoteService
\`\`\`

#### Step 8: Open Firewall
\`\`\`powershell
New-NetFirewallRule -DisplayName "Stick My Note Application" `
  -Direction Inbound `
  -LocalPort 3000 `
  -Protocol TCP `
  -Action Allow
\`\`\`

#### Step 9: Verify Service Started
\`\`\`powershell
# Check service status
nssm status StickyNoteService
# Should show: SERVICE_RUNNING

# Check logs
Get-Content C:\StickyNote\logs\service-output.log -Tail 20
\`\`\`

### Test It Works
\`\`\`powershell
# Test from the web server itself
Invoke-WebRequest -Uri "http://localhost:3000" -UseBasicParsing
# Should return HTML

# Check health endpoint
Invoke-RestMethod -Uri "http://localhost:3000/api/health"
# Should return JSON with status information
\`\`\`

#### Step 10: Configure SSL/HTTPS (Optional but Recommended)

**Option A: Using IIS as Reverse Proxy**
\`\`\`powershell
# Install IIS
Install-WindowsFeature -Name Web-Server -IncludeManagementTools
Install-WindowsFeature -Name Web-Http-Redirect
Install-WindowsFeature -Name Web-App-Dev

# Install URL Rewrite Module
# Download from: https://www.iis.net/downloads/microsoft/url-rewrite

# Install Application Request Routing
# Download from: https://www.iis.net/downloads/microsoft/application-request-routing

# Import SSL certificate for www.stickmynote.com
# In IIS Manager → Server Certificates → Import

# Create reverse proxy rules in IIS
\`\`\`

**Option B: Using Nginx (Simpler)**
\`\`\`powershell
# Download from: https://nginx.org/en/download.html
# Extract to C:\nginx

# Edit C:\nginx\conf\nginx.conf
\`\`\`

\`\`\`nginx
http {
    upstream stickmynote {
        server 127.0.0.1:3000;
    }

    server {
        listen 80;
        server_name www.stickmynote.com;
        return 301 https://$server_name$request_uri;
    }

    server {
        listen 443 ssl http2;
        server_name www.stickmynote.com;

        ssl_certificate C:/SSL/stickmynote.crt;
        ssl_certificate_key C:/SSL/stickmynote.key;

        location / {
            proxy_pass http://stickmynote;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
}
\`\`\`

\`\`\`powershell
# Install as service
nssm install NginxService "C:\nginx\nginx.exe"
nssm set NginxService AppDirectory "C:\nginx"
nssm start NginxService
\`\`\`

---

## Final Steps - Configure Through Web Interface

### Access the Application
1. Open browser
2. Go to: `http://192.168.50.20:3000` (or `https://www.stickmynote.com` if SSL configured)
3. Complete initial setup wizard

### Configure Server Settings in UI
1. Login with admin account
2. Go to: **Settings → Organization → Server Config**
3. Fill in all server details:
   - PostgreSQL: Host `192.168.50.30`, Port `5432`, credentials
   - Redis: Host `192.168.50.50`, Port `6379`, password
   - SMTP: Host `192.168.50.40`, Port `587`, credentials
4. Click **Test Connection** for each service
5. Click **Save Configuration**

---

## Quick Reference: Service Management

### On Web Server (HOL-DC2-IIS)
\`\`\`powershell
# Check status
nssm status StickyNoteService

# Start service
nssm start StickyNoteService

# Stop service
nssm stop StickyNoteService

# Restart service
nssm restart StickyNoteService

# View logs
Get-Content C:\StickyNote\logs\service-output.log -Tail 50 -Wait
\`\`\`

### Test All Connections
\`\`\`powershell
# From Web Server, test database
Test-NetConnection -ComputerName 192.168.50.30 -Port 5432

# Test Redis
Test-NetConnection -ComputerName 192.168.50.50 -Port 6379

# Test SMTP
Test-NetConnection -ComputerName 192.168.50.40 -Port 587

# Test application
Invoke-RestMethod -Uri "http://localhost:3000/api/health/deployment"
\`\`\`

---

## Security Checklist

- [ ] **Database Server**: Firewall only allows Web Server IP
- [ ] **Redis Server**: Strong password set, firewall only allows Web Server IP
- [ ] **Exchange Server**: Service account has minimal permissions
- [ ] **Web Server**: Upload directories have restricted permissions
- [ ] **All Servers**: Windows Updates enabled and current
- [ ] **All Servers**: Antivirus installed and updated
- [ ] **Application**: All secrets are strong random strings
- [ ] **Network**: All servers on same private network (192.168.50.x)

---

## Support

**Logs Location:**
- Web Server: `C:\StickyNote\logs\`
- PostgreSQL: `C:\Program Files\PostgreSQL\15\data\log\`
- Redis: `C:\Program Files\Memurai\Logs\`

**Health Check:**
`http://your-server:3000/api/health/deployment`

**Need Help?**
Check `WINDOWS_SERVICE_DEPLOYMENT.md` for detailed information.

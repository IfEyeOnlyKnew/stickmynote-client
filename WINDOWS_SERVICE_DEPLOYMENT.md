# Windows Service Deployment Guide - Distributed Architecture

## Overview

This guide covers deploying Stick My Note as a Windows Service on a distributed architecture with dedicated servers for each component.

---

## Architecture

\`\`\`
┌─────────────────────────────────────────────────────────────┐
│  Application Server (10.0.1.10)                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Stick My Note Windows Service (NSSM)               │   │
│  │  - Node.js 20 LTS                                   │   │
│  │  - Port: 3000                                       │   │
│  │  - Auto-restart on failure                          │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Nginx/Caddy (Optional Reverse Proxy)              │   │
│  │  - SSL Termination (Port 443)                       │   │
│  │  - Proxy to Port 3000                               │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│  Database Server (10.0.2.10)                                │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  PostgreSQL 15                                      │   │
│  │  - Port: 5432                                       │   │
│  │  - pgAdmin 4 for management                         │   │
│  │  - Automated backups                                │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│  Redis Server (10.0.3.10)                                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Redis 7                                            │   │
│  │  - Port: 6379                                       │   │
│  │  - Caching & Rate Limiting                          │   │
│  │  - Persistence enabled                              │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│  Exchange Server (10.0.4.10)                                │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Microsoft Exchange Server                          │   │
│  │  - SMTP Port: 587 (TLS) or 25 (relay)             │   │
│  │  - Email relay for application                      │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
\`\`\`

---

## Prerequisites

### All Servers
- Windows Server 2019 or 2022
- Network connectivity between servers
- Firewall rules configured
- NTP time synchronization

### Application Server (10.0.1.10)
- 4 CPU cores, 8 GB RAM, 100 GB SSD
- Node.js 20 LTS
- NSSM (Non-Sucking Service Manager)
- Git (optional, for deployment)

### Database Server (10.0.2.10)
- 8 CPU cores, 16 GB RAM, 500 GB SSD (RAID 10)
- PostgreSQL 15+
- pgAdmin 4

### Redis Server (10.0.3.10)
- 2 CPU cores, 4 GB RAM, 50 GB SSD
- Redis for Windows 7+

### Exchange Server (10.0.4.10)
- Your existing Exchange infrastructure
- SMTP relay configured

---

## Installation Steps

### STEP 1: Database Server Setup (10.0.2.10)

#### 1.1 Install PostgreSQL
\`\`\`powershell
# Download PostgreSQL 15 from https://www.postgresql.org/download/windows/
# Run installer with these settings:
# - Port: 5432
# - Password: (choose strong password)
# - Locale: English, United States
# - Install pgAdmin 4: Yes
\`\`\`

#### 1.2 Configure PostgreSQL for Network Access
\`\`\`powershell
# Edit C:\Program Files\PostgreSQL\15\data\postgresql.conf
# Change:
listen_addresses = '*'  # Listen on all interfaces

# Edit C:\Program Files\PostgreSQL\15\data\pg_hba.conf
# Add at the end:
host    all             all             10.0.1.0/24            scram-sha-256
host    all             all             10.0.0.0/16            scram-sha-256

# Restart PostgreSQL service
Restart-Service postgresql-x64-15
\`\`\`

#### 1.3 Configure Windows Firewall
\`\`\`powershell
New-NetFirewallRule -DisplayName "PostgreSQL" `
  -Direction Inbound `
  -LocalPort 5432 `
  -Protocol TCP `
  -Action Allow
\`\`\`

#### 1.4 Create Database and User
\`\`\`sql
-- Open pgAdmin 4 or psql
CREATE DATABASE stickmynote;
CREATE USER stickmynote_user WITH ENCRYPTED PASSWORD 'your_secure_password_here';
GRANT ALL PRIVILEGES ON DATABASE stickmynote TO stickmynote_user;
ALTER DATABASE stickmynote OWNER TO stickmynote_user;

-- Connect to stickmynote database
\c stickmynote

-- Grant schema privileges
GRANT ALL ON SCHEMA public TO stickmynote_user;
\`\`\`

#### 1.5 Run Database Migrations
\`\`\`powershell
# Copy migration scripts to database server
# C:\DatabaseMigrations\

# Run migrations
cd C:\DatabaseMigrations
psql -U stickmynote_user -d stickmynote -h localhost -f 01-create-all-tables.sql
psql -U stickmynote_user -d stickmynote -h localhost -f 02-create-server-config-table.sql
\`\`\`

#### 1.6 Configure Automated Backups
\`\`\`powershell
# Create backup script: C:\Scripts\backup-stickmynote.ps1
$backupDir = "D:\Backups\PostgreSQL"
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupFile = "$backupDir\stickmynote_$timestamp.sql"

& "C:\Program Files\PostgreSQL\15\bin\pg_dump.exe" `
  -U stickmynote_user `
  -h localhost `
  -d stickmynote `
  -F c `
  -f $backupFile

# Keep only last 30 days of backups
Get-ChildItem $backupDir -Filter "*.sql" | 
  Where-Object {$_.LastWriteTime -lt (Get-Date).AddDays(-30)} |
  Remove-Item

# Schedule daily backups
$action = New-ScheduledTaskAction -Execute "PowerShell.exe" `
  -Argument "-File C:\Scripts\backup-stickmynote.ps1"
$trigger = New-ScheduledTaskTrigger -Daily -At 2:00AM
Register-ScheduledTask -Action $action -Trigger $trigger `
  -TaskName "StickyNote DB Backup" -Description "Daily PostgreSQL backup"
\`\`\`

---

### STEP 2: Redis Server Setup (10.0.3.10)

#### 2.1 Install Redis for Windows
\`\`\`powershell
# Download Redis from https://github.com/microsoftarchive/redis/releases
# Or use Memurai (modern Redis fork): https://www.memurai.com/

# Extract to C:\Redis
# Copy redis.windows.conf to redis.conf
\`\`\`

#### 2.2 Configure Redis
\`\`\`conf
# Edit C:\Redis\redis.conf

# Network
bind 0.0.0.0
protected-mode yes
port 6379

# Security
requirepass your_redis_password_here

# Persistence
save 900 1
save 300 10
save 60 10000
appendonly yes
appendfilename "appendonly.aof"

# Memory
maxmemory 2gb
maxmemory-policy allkeys-lru

# Logging
logfile "C:\\Redis\\logs\\redis.log"
loglevel notice
\`\`\`

#### 2.3 Install as Windows Service
\`\`\`powershell
# Using NSSM (recommended)
cd C:\Redis
nssm install RedisService "C:\Redis\redis-server.exe" "C:\Redis\redis.conf"
nssm set RedisService AppDirectory C:\Redis
nssm set RedisService DisplayName "Redis Cache Server"
nssm set RedisService Description "Redis cache for Stick My Note"
nssm set RedisService Start SERVICE_AUTO_START
nssm start RedisService

# Or using built-in method
redis-server --service-install redis.conf --service-name RedisService
redis-server --service-start --service-name RedisService
\`\`\`

#### 2.4 Configure Windows Firewall
\`\`\`powershell
New-NetFirewallRule -DisplayName "Redis" `
  -Direction Inbound `
  -LocalPort 6379 `
  -Protocol TCP `
  -Action Allow
\`\`\`

#### 2.5 Test Connection
\`\`\`powershell
# From Application Server
redis-cli -h 10.0.3.10 -p 6379 -a your_redis_password_here ping
# Should return: PONG
\`\`\`

---

### STEP 3: Exchange Server Configuration (10.0.4.10)

#### 3.1 Create Service Account
\`\`\`powershell
# On Exchange Server or Domain Controller
New-ADUser -Name "StickyNote Service" `
  -SamAccountName "stickmynote_svc" `
  -UserPrincipalName "stickmynote@yourdomain.com" `
  -AccountPassword (ConvertTo-SecureString "Password123!" -AsPlainText -Force) `
  -Enabled $true `
  -PasswordNeverExpires $true
\`\`\`

#### 3.2 Configure Send Connector (Option A: Relay)
\`\`\`powershell
# On Exchange Server
New-SendConnector -Name "StickyNote Relay" `
  -Usage Custom `
  -AddressSpaces '*' `
  -IsScopedConnector $false `
  -DNSRoutingEnabled $false `
  -SmartHosts 10.0.1.10 `
  -SourceTransportServers (Get-ExchangeServer)

# Allow relay from Application Server
Get-ReceiveConnector | Where-Object {$_.Name -like "*Default*"} | 
  Add-ADPermission -User "Anonymous Logon" -ExtendedRights "ms-Exch-SMTP-Accept-Any-Recipient"

# Add Application Server IP to relay
Set-ReceiveConnector -Identity "Default Connector" `
  -RemoteIPRanges @{Add="10.0.1.10"}
\`\`\`

#### 3.3 Configure Authenticated SMTP (Option B: Recommended)
\`\`\`powershell
# Grant "Send As" permission
Add-ADPermission -Identity "StickyNote Service" `
  -User "stickmynote_svc" `
  -ExtendedRights "Send-As"

# Configure mailbox
Enable-Mailbox -Identity "stickmynote_svc" `
  -Alias "stickmynote" `
  -Database "Mailbox Database"

# Set SMTP credentials for app:
# Host: mail.yourdomain.com (or 10.0.4.10)
# Port: 587 (TLS) or 25 (internal)
# Username: stickmynote@yourdomain.com
# Password: Password123!
\`\`\`

---

### STEP 4: Application Server Setup (10.0.1.10)

#### 4.1 Install Node.js
\`\`\`powershell
# Download Node.js 20 LTS from https://nodejs.org
# Run installer
# Verify:
node --version  # Should show v20.x.x
npm --version   # Should show 10.x.x
\`\`\`

#### 4.2 Install NSSM
\`\`\`powershell
# Download from https://nssm.cc/download
# Extract to C:\Tools\nssm
# Add to PATH
[Environment]::SetEnvironmentVariable(
  "Path",
  $env:Path + ";C:\Tools\nssm\win64",
  [EnvironmentVariableTarget]::Machine
)
\`\`\`

#### 4.3 Deploy Application Files
\`\`\`powershell
# Create application directory
mkdir C:\StickyNote
cd C:\StickyNote

# Option A: Copy from build server
Copy-Item -Path "\\buildserver\builds\stickmynote\*" -Destination "." -Recurse

# Option B: Clone from Git
git clone https://your-repo-url.git .
\`\`\`

#### 4.4 Install Dependencies
\`\`\`powershell
cd C:\StickyNote
npm install --production

# Or if you need to build:
npm install
npm run build
\`\`\`

#### 4.5 Create Environment Configuration
\`\`\`powershell
# Create C:\StickyNote\.env.production
\`\`\`

\`\`\`env
# Deployment Mode
NODE_ENV=production
DEPLOYMENT_MODE=windows_service

# Database (Remote PostgreSQL Server)
DATABASE_URL=postgresql://stickmynote_user:your_password@10.0.2.10:5432/stickmynote
POSTGRES_HOST=10.0.2.10
POSTGRES_PORT=5432
POSTGRES_DATABASE=stickmynote
POSTGRES_USER=stickmynote_user
POSTGRES_PASSWORD=your_secure_password_here

# Redis (Remote Redis Server)
REDIS_URL=redis://:your_redis_password@10.0.3.10:6379
REDIS_HOST=10.0.3.10
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password_here
REDIS_DATABASE=0

# Email (Exchange Server)
SMTP_HOST=10.0.4.10
SMTP_PORT=587
SMTP_USE_TLS=true
SMTP_USER=stickmynote@yourdomain.com
SMTP_PASSWORD=Password123!
SMTP_FROM_EMAIL=noreply@ifeyeonlyknew.com
SMTP_FROM_NAME=Stick My Note

# Application
NEXT_PUBLIC_SITE_URL=https://www.ifeyeonlyknew.com
APP_NAME=Stick My Note
PORT=3000

# File Storage (Local)
UPLOAD_DIR=C:\StickyNote\uploads
MAX_FILE_SIZE_MB=10

# Security
CSRF_SECRET=generate-random-32-character-string-here
JWT_SECRET=generate-random-32-character-string-here
ENCRYPTION_KEY=generate-random-32-character-string-here

# Rate Limiting
RATE_LIMIT_ENABLED=true
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_WINDOW_MS=60000
\`\`\`

#### 4.6 Create Upload Directories
\`\`\`powershell
mkdir C:\StickyNote\uploads
mkdir C:\StickyNote\uploads\avatars
mkdir C:\StickyNote\uploads\images
mkdir C:\StickyNote\uploads\documents
mkdir C:\StickyNote\logs

# Set permissions
icacls "C:\StickyNote\uploads" /grant "NetworkService:(OI)(CI)M" /T
icacls "C:\StickyNote\logs" /grant "NetworkService:(OI)(CI)M" /T
\`\`\`

#### 4.7 Install as Windows Service
\`\`\`powershell
# Run the installation script
cd C:\StickyNote\windows-service
.\install-service.ps1
\`\`\`

**Or manually:**
\`\`\`powershell
nssm install StickyNoteService "C:\Program Files\nodejs\node.exe"
nssm set StickyNoteService AppParameters "C:\StickyNote\server.js"
nssm set StickyNoteService AppDirectory "C:\StickyNote"
nssm set StickyNoteService DisplayName "Stick My Note Application"
nssm set StickyNoteService Description "Stick My Note - Collaborative Note Taking Platform"
nssm set StickyNoteService Start SERVICE_AUTO_START
nssm set StickyNoteService ObjectName "NetworkService"
nssm set StickyNoteService AppStdout "C:\StickyNote\logs\service-output.log"
nssm set StickyNoteService AppStderr "C:\StickyNote\logs\service-error.log"
nssm set StickyNoteService AppRotateFiles 1
nssm set StickyNoteService AppRotateBytes 10485760
nssm set StickyNoteService AppEnvironmentExtra "NODE_ENV=production"

# Start the service
nssm start StickyNoteService
\`\`\`

#### 4.8 Configure Windows Firewall
\`\`\`powershell
New-NetFirewallRule -DisplayName "Stick My Note" `
  -Direction Inbound `
  -LocalPort 3000 `
  -Protocol TCP `
  -Action Allow
\`\`\`

---

### STEP 5: Reverse Proxy Setup (Optional but Recommended)

#### Option A: Nginx for Windows
\`\`\`powershell
# Download from https://nginx.org/en/download.html
# Extract to C:\nginx
\`\`\`

\`\`\`nginx
# C:\nginx\conf\nginx.conf
http {
    upstream stickmynote {
        server 127.0.0.1:3000;
    }

    server {
        listen 80;
        server_name www.ifeyeonlyknew.com;
        return 301 https://$server_name$request_uri;
    }

    server {
        listen 443 ssl http2;
        server_name www.ifeyeonlyknew.com;

        ssl_certificate C:/SSL/www.ifeyeonlyknew.com.crt;
        ssl_certificate_key C:/SSL/www.ifeyeonlyknew.com.key;

        location / {
            proxy_pass http://stickmynote;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
        }
    }
}
\`\`\`

#### Option B: Caddy (Easier SSL)
\`\`\`powershell
# Download from https://caddyserver.com/download
# Extract to C:\Caddy
\`\`\`

```caddy
# C:\Caddy\Caddyfile
www.ifeyeonlyknew.com {
    reverse_proxy localhost:3000
    tls your-email@domain.com
    encode gzip
}

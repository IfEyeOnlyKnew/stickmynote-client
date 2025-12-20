# PostgreSQL SSL Setup with Self-Signed Certificate

This guide shows how to create and configure a self-signed SSL certificate for PostgreSQL using OpenSSL.

## Prerequisites

- PostgreSQL installed on Windows Server
- OpenSSL installed (usually comes with Git for Windows or can be installed separately)
- Administrator access to the PostgreSQL server

## Step 1: Generate Self-Signed Certificate

### Option A: Using OpenSSL (Recommended)

Open PowerShell as Administrator on your PostgreSQL server (HOL-DC3-PGSQL.stickmynote.com):

```powershell
# Navigate to PostgreSQL data directory
cd "C:\Program Files\PostgreSQL\15\data"

# Or if PostgreSQL is in a different location, find it:
# Get-Service | Where-Object {$_.DisplayName -like "*PostgreSQL*"}

# Generate private key (2048-bit RSA)
openssl genrsa -out server.key 2048

# Generate self-signed certificate (valid for 365 days)
openssl req -new -x509 -days 365 -key server.key -out server.crt -subj "/CN=HOL-DC3-PGSQL.stickmynote.com"

# Create certificate request (if you need it for verification)
openssl req -new -key server.key -out server.csr -subj "/CN=HOL-DC3-PGSQL.stickmynote.com"
```

### Option B: Generate with More Details

For a more detailed certificate with organization information:

```powershell
openssl req -new -x509 -days 365 -nodes -text -out server.crt -keyout server.key -subj "/C=US/ST=State/L=City/O=Organization/OU=Department/CN=HOL-DC3-PGSQL.stickmynote.com"
```

Replace with your actual details:
- `C=US` - Country
- `ST=State` - State/Province
- `L=City` - City
- `O=Organization` - Organization name
- `OU=Department` - Department
- `CN=HOL-DC3-PGSQL.stickmynote.com` - Common Name (must match server hostname)

### Option C: Interactive Generation

If you prefer to enter details interactively:

```powershell
# Generate private key
openssl genrsa -out server.key 2048

# Generate certificate signing request (interactive)
openssl req -new -key server.key -out server.csr

# Self-sign the certificate
openssl x509 -req -days 365 -in server.csr -signkey server.key -out server.crt
```

## Step 2: Set File Permissions

PostgreSQL requires specific permissions on the certificate files:

```powershell
# Set permissions so only SYSTEM and Administrators can read the key
icacls server.key /inheritance:r
icacls server.key /grant:r "NT AUTHORITY\SYSTEM:(R)"
icacls server.key /grant:r "BUILTIN\Administrators:(R)"
icacls server.key /grant:r "NT AUTHORITY\NetworkService:(R)"

# Certificate can be more permissive
icacls server.crt /inheritance:r
icacls server.crt /grant:r "Everyone:(R)"

# If PostgreSQL runs under a specific service account, grant it access:
# icacls server.key /grant:r "postgres:(R)"
```

**Important:** The key file must NOT be world-readable. PostgreSQL will refuse to start if permissions are too open.

## Step 3: Configure PostgreSQL

Edit `postgresql.conf` (usually in `C:\Program Files\PostgreSQL\15\data\postgresql.conf`):

```ini
# Enable SSL
ssl = on

# Certificate files
ssl_cert_file = 'server.crt'
ssl_key_file = 'server.key'

# Optional: Specify allowed SSL ciphers
# ssl_ciphers = 'HIGH:MEDIUM:+3DES:!aNULL'

# Optional: Minimum SSL protocol version
# ssl_min_protocol_version = 'TLSv1.2'
```

### Optional: Force SSL Connections

Edit `pg_hba.conf` to require SSL for specific connections:

```ini
# Require SSL for remote connections
hostssl all all 0.0.0.0/0 scram-sha-256

# Allow non-SSL for localhost only
host all all 127.0.0.1/32 scram-sha-256
host all all ::1/128 scram-sha-256
```

**Note:** `hostssl` requires SSL, `host` allows non-SSL. Use `hostssl` for production.

## Step 4: Restart PostgreSQL Service

```powershell
# Restart PostgreSQL service
Restart-Service -Name postgresql*

# Or find the exact service name:
Get-Service | Where-Object {$_.DisplayName -like "*PostgreSQL*"}

# Then restart with exact name:
Restart-Service -Name "postgresql-x64-15"  # Adjust version number
```

## Step 5: Verify SSL Configuration

### On PostgreSQL Server

```powershell
# Check if PostgreSQL is listening with SSL
netstat -ano | findstr :5432

# Check PostgreSQL logs for SSL messages
Get-Content "C:\Program Files\PostgreSQL\15\data\log\postgresql-*.log" -Tail 50
```

Look for messages like:
```
LOG:  starting PostgreSQL ... on x86_64-pc-mingw64, compiled by gcc.exe ...
LOG:  listening on IPv4 address "0.0.0.0", port 5432
LOG:  SSL enabled
```

### From Client (Your Application Server)

Update your `.env.local`:

```env
POSTGRES_SSL=true
POSTGRES_SSL_REJECT_UNAUTHORIZED=false
```

Then test:

```powershell
pnpm test:db
```

## Step 6: Test SSL Connection Manually

### Using psql with SSL

```bash
# Test SSL connection
psql "postgresql://stickmynote_user:password@HOL-DC3-PGSQL.stickmynote.com:5432/stickmynote?sslmode=require"

# Or with separate parameters
psql -h HOL-DC3-PGSQL.stickmynote.com -p 5432 -U stickmynote_user -d stickmynote "sslmode=require"
```

### Check SSL Status from SQL

Once connected:

```sql
-- Check if SSL is enabled
SHOW ssl;

-- Check current connection's SSL status
SELECT * FROM pg_stat_ssl WHERE pid = pg_backend_pid();

-- View all SSL connections
SELECT pid, usename, client_addr, ssl, cipher 
FROM pg_stat_ssl 
JOIN pg_stat_activity USING (pid);
```

## Troubleshooting

### Error: "private key file has group or world access"

**Fix permissions on Windows:**

```powershell
icacls server.key /inheritance:r
icacls server.key /grant:r "NT AUTHORITY\SYSTEM:(R)"
icacls server.key /grant:r "BUILTIN\Administrators:(R)"
```

### Error: "could not load server certificate file"

**Check file paths in postgresql.conf:**

```powershell
# Verify files exist
Test-Path "C:\Program Files\PostgreSQL\15\data\server.crt"
Test-Path "C:\Program Files\PostgreSQL\15\data\server.key"

# Use full paths if relative paths don't work
ssl_cert_file = 'C:/Program Files/PostgreSQL/15/data/server.crt'
ssl_key_file = 'C:/Program Files/PostgreSQL/15/data/server.key'
```

### Error: "The server does not support SSL connections"

**Check that SSL is enabled:**

```sql
SHOW ssl;  -- Should return 'on'
```

If it returns 'off', check:
1. `postgresql.conf` has `ssl = on`
2. Certificate files exist and have correct permissions
3. PostgreSQL service has been restarted

### Client Connection Fails with Certificate Error

**Option 1:** Accept self-signed certificate (development):
```env
POSTGRES_SSL=true
POSTGRES_SSL_REJECT_UNAUTHORIZED=false
```

**Option 2:** Add certificate to trusted store (production):
- Export `server.crt` from PostgreSQL server
- Import to Windows certificate store on application server
- Set `POSTGRES_SSL_REJECT_UNAUTHORIZED=true`

## Security Best Practices

### For Development/Internal Networks

✅ Self-signed certificates are acceptable
✅ Use `POSTGRES_SSL_REJECT_UNAUTHORIZED=false`
✅ Ensure firewall restricts access to trusted IPs

### For Production/Public Networks

✅ Use certificates from trusted CA (Let's Encrypt, etc.)
✅ Enable `POSTGRES_SSL_REJECT_UNAUTHORIZED=true`
✅ Use strong ciphers and TLS 1.2+
✅ Rotate certificates before expiration
✅ Force SSL connections in `pg_hba.conf`

## Certificate Renewal

Certificates expire. To renew:

```powershell
# Generate new certificate (same key or new key)
cd "C:\Program Files\PostgreSQL\15\data"

# Option 1: Reuse existing key
openssl req -new -x509 -days 365 -key server.key -out server.crt -subj "/CN=HOL-DC3-PGSQL.stickmynote.com"

# Option 2: Generate new key and certificate
openssl genrsa -out server.key 2048
openssl req -new -x509 -days 365 -key server.key -out server.crt -subj "/CN=HOL-DC3-PGSQL.stickmynote.com"

# Set permissions
icacls server.key /inheritance:r
icacls server.key /grant:r "NT AUTHORITY\SYSTEM:(R)"
icacls server.key /grant:r "BUILTIN\Administrators:(R)"

# Restart PostgreSQL
Restart-Service postgresql*
```

## Quick Reference

### Certificate Files Location
- Windows: `C:\Program Files\PostgreSQL\15\data\`
- Linux: `/var/lib/postgresql/data/` or `/etc/postgresql/15/main/`

### Required Files
- `server.key` - Private key (restrictive permissions)
- `server.crt` - Public certificate

### Configuration Files
- `postgresql.conf` - SSL settings
- `pg_hba.conf` - Connection authentication rules

### Service Management
```powershell
# Windows
Restart-Service postgresql*
Get-Service postgresql*

# Linux
sudo systemctl restart postgresql
sudo systemctl status postgresql
```

## Next Steps

After completing this setup:

1. ✅ Verify SSL is working: `pnpm test:db`
2. ✅ Update your application's `.env.local` with SSL settings
3. ✅ Monitor PostgreSQL logs for SSL connection messages
4. ✅ Set calendar reminder for certificate renewal (before 365 days)
5. ✅ Document certificate location and renewal process for your team

---

## Additional Resources

- [PostgreSQL SSL Documentation](https://www.postgresql.org/docs/current/ssl-tcp.html)
- [OpenSSL Documentation](https://www.openssl.org/docs/)
- [PostgreSQL pg_hba.conf](https://www.postgresql.org/docs/current/auth-pg-hba-conf.html)

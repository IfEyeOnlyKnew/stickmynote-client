# PostgreSQL Remote Server Configuration Guide

This guide covers setting up and securing your Next.js application to connect to a remote PostgreSQL server.

## Table of Contents
- [Configuration](#configuration)
- [Security Checklist](#security-checklist)
- [Testing Connection](#testing-connection)
- [Troubleshooting](#troubleshooting)

---

## Configuration

### 1. Environment Variables Setup

Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```

### 2. Configure Remote PostgreSQL Connection

Edit `.env.local` with your remote server details:

```env
# PostgreSQL Remote Server Configuration
POSTGRES_HOST=your-remote-server.com
POSTGRES_PORT=5432
POSTGRES_DATABASE=stickmynote
POSTGRES_USER=your_postgres_user
POSTGRES_PASSWORD=your_secure_password
POSTGRES_SSL=true

# Alternative: Connection URL format
POSTGRES_URL=postgresql://user:password@your-remote-server.com:5432/stickmynote?sslmode=require
```

### 3. Database Adapter Mode

Choose between Supabase or direct PostgreSQL:

**Option A: Use Supabase (default)**
```env
USE_DATABASE_ADAPTER=false
# Fill in Supabase credentials
SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

**Option B: Direct PostgreSQL**
```env
USE_DATABASE_ADAPTER=true
# Only PostgreSQL credentials needed
```

---

## Security Checklist

### ✅ SSL/TLS Connection

**REQUIRED for production remote connections:**

```env
POSTGRES_SSL=true
```

For self-signed certificates:
```env
POSTGRES_SSL=true
POSTGRES_SSL_REJECT_UNAUTHORIZED=false
```

### ✅ Connection String Security

**NEVER expose connection strings with credentials in:**
- Git repositories
- Client-side code
- Error messages
- Logs

**DO:**
- Use environment variables
- Rotate credentials regularly
- Use read-only users when possible
- Implement connection pooling

### ✅ Firewall Configuration

On your remote PostgreSQL server:

1. **Restrict IP Access** (postgresql.conf):
```
listen_addresses = 'specific-ip-or-localhost'
```

2. **Configure pg_hba.conf**:
```
# Allow SSL connections only
hostssl all all 0.0.0.0/0 scram-sha-256
```

3. **Firewall Rules**:
```bash
# Allow only from your application server IP
sudo ufw allow from YOUR_APP_SERVER_IP to any port 5432
```

### ✅ Connection Pooling

Current configuration (lib/database/pg-client.ts):
```typescript
max: 20,                        // Maximum pool size
idleTimeoutMillis: 30000,       // 30 seconds
connectionTimeoutMillis: 10000  // 10 seconds
```

Adjust based on your needs and server capacity.

### ✅ User Permissions

Create a dedicated database user with minimal permissions:

```sql
-- Create user
CREATE USER stickmynote_app WITH PASSWORD 'strong_password_here';

-- Grant only necessary permissions
GRANT CONNECT ON DATABASE stickmynote TO stickmynote_app;
GRANT USAGE ON SCHEMA public TO stickmynote_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO stickmynote_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO stickmynote_app;

-- For future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public 
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO stickmynote_app;
```

---

## Testing Connection

### Method 1: Run Test Script

```bash
# Install dependencies first
pnpm install

# Add to package.json scripts:
"test:db": "tsx scripts/test-db-connection.ts"

# Run test
pnpm test:db
```

### Method 2: Manual Testing with psql

```bash
# Test from command line
psql "postgresql://user:password@your-server:5432/database?sslmode=require"

# Or
psql -h your-server.com -p 5432 -U your_user -d stickmynote
```

### Method 3: API Health Check

Start your application and check:
```bash
curl http://localhost:3000/api/database-health
```

---

## Troubleshooting

### Connection Refused

**Symptoms:** `ECONNREFUSED` or `connection refused`

**Solutions:**
1. Verify PostgreSQL is running:
   ```bash
   sudo systemctl status postgresql
   ```

2. Check PostgreSQL is listening on the correct port:
   ```bash
   sudo netstat -plnt | grep 5432
   ```

3. Verify firewall allows connection:
   ```bash
   telnet your-server.com 5432
   ```

### SSL/TLS Errors

**Symptoms:** `SSL connection required` or certificate errors

**Solutions:**
1. Enable SSL in environment:
   ```env
   POSTGRES_SSL=true
   ```

2. For self-signed certificates:
   ```env
   POSTGRES_SSL_REJECT_UNAUTHORIZED=false
   ```

3. Verify server SSL configuration:
   ```sql
   SHOW ssl;
   ```

### Authentication Failed

**Symptoms:** `password authentication failed`

**Solutions:**
1. Verify credentials in `.env.local`
2. Check pg_hba.conf authentication method
3. Reset password:
   ```sql
   ALTER USER your_user WITH PASSWORD 'new_password';
   ```

### Timeout Errors

**Symptoms:** Connection timeouts

**Solutions:**
1. Increase timeout values in `pg-client.ts`:
   ```typescript
   connectionTimeoutMillis: 30000  // Increase to 30s
   ```

2. Check network latency:
   ```bash
   ping your-server.com
   traceroute your-server.com
   ```

3. Verify max_connections on server:
   ```sql
   SHOW max_connections;
   ```

### Connection Pool Exhausted

**Symptoms:** `remaining connection slots reserved` or pool timeout

**Solutions:**
1. Increase pool size:
   ```typescript
   max: 50  // Increase max connections
   ```

2. Check for connection leaks (ensure `client.release()` is called)

3. Monitor active connections:
   ```sql
   SELECT count(*) FROM pg_stat_activity;
   ```

---

## Performance Optimization

### 1. Use Connection Pooling
Already configured in `lib/database/pg-client.ts`

### 2. Enable Query Logging (Development Only)
```env
POSTGRES_LOG_QUERIES=true
```

### 3. Add Indexes
Monitor slow queries and add appropriate indexes:
```sql
-- Example: Index on frequently queried columns
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_notes_user_id ON notes(user_id);
```

### 4. Use Read Replicas (Production)
For high-traffic applications, consider:
- Read replica for SELECT queries
- Primary server for writes
- Load balancing between replicas

---

## Monitoring

### Database Health Endpoint

The application includes a health check endpoint:
- URL: `/api/database-health`
- Returns: Connection status, query performance

### Logging

Database operations are logged with:
- Query text (first 100 chars)
- Execution duration
- Row count

Monitor logs for slow queries (>1000ms).

---

## Production Checklist

Before deploying to production:

- [ ] SSL/TLS enabled (`POSTGRES_SSL=true`)
- [ ] Strong passwords used
- [ ] Firewall configured (IP whitelist)
- [ ] Connection pooling configured
- [ ] Backup strategy in place
- [ ] Monitoring and alerts set up
- [ ] User permissions minimized
- [ ] Query logging disabled in production
- [ ] Environment variables secured
- [ ] Connection string format validated
- [ ] Health check endpoint tested
- [ ] Failover strategy documented

---

## Additional Resources

- [PostgreSQL Security Best Practices](https://www.postgresql.org/docs/current/security.html)
- [Node.js pg Driver Documentation](https://node-postgres.com/)
- [SSL Certificate Management](https://www.postgresql.org/docs/current/ssl-tcp.html)

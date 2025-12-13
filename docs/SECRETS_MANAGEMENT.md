# Secrets Management Guide

## Overview

This guide covers best practices for managing secrets and sensitive configuration in the Stick My Note application.

## Core Principles

### 1. Never Commit Secrets
- **NEVER** commit `.env` files or any files containing secrets to version control
- Use `.env.example` as a template with placeholder values
- Add all secret files to `.gitignore`

### 2. Use Environment Variables
- Store all secrets in environment variables
- Use Vercel's environment variable management for production
- Use `.env.local` for local development (never committed)

### 3. Validate at Startup
- All environment variables are validated at application startup
- Missing required variables cause immediate failure
- Type-safe access prevents typos and errors

### 4. Principle of Least Privilege
- Use service-specific API keys with minimal required permissions
- Rotate keys regularly
- Revoke unused keys immediately

## Environment Variable Types

### Required Variables
These must be set for the application to function:

\`\`\`bash
# Supabase Authentication & Database
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_JWT_SECRET=your-jwt-secret

# Security
CSRF_SECRET=generate-random-32-byte-string

# Application
NEXT_PUBLIC_SITE_URL=https://yourdomain.com
\`\`\`

### Optional but Recommended
These enhance functionality but aren't strictly required:

\`\`\`bash
# Rate Limiting (highly recommended for production)
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token

# Email (for notifications)
RESEND_API_KEY=your-resend-key
RESEND_FROM_EMAIL=noreply@yourdomain.com

# Error Tracking (for monitoring)
SENTRY_DSN=https://your-sentry-dsn
\`\`\`

### Optional Features
These enable specific features:

\`\`\`bash
# AI Tag Generation
XAI_API_KEY=your-xai-key

# File Storage
BLOB_READ_WRITE_TOKEN=your-blob-token

# Video Conferencing
DAILY_API_KEY=your-daily-key

# Web Search
BRAVE_API_KEY=your-brave-key
\`\`\`

## Local Development Setup

### 1. Copy Environment Template
\`\`\`bash
cp .env.example .env.local
\`\`\`

### 2. Fill in Required Values
Edit `.env.local` and add your actual values:
- Get Supabase credentials from your Supabase project dashboard
- Generate CSRF secret: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`
- Set NEXT_PUBLIC_SITE_URL to `http://localhost:3000`

### 3. Verify Configuration
\`\`\`bash
npm run dev
\`\`\`

Check console for validation messages. Fix any errors before proceeding.

## Production Deployment

### Vercel Environment Variables

1. **Navigate to Project Settings**
   - Go to your Vercel project
   - Click "Settings" → "Environment Variables"

2. **Add Required Variables**
   - Add each required variable
   - Mark sensitive variables as "Sensitive" (they'll be encrypted)
   - Set appropriate environment (Production, Preview, Development)

3. **Variable Scopes**
   - **Production**: Live site only
   - **Preview**: Pull request previews
   - **Development**: Local development (rarely used)

### Security Best Practices

#### 1. Separate Environments
Use different credentials for each environment:
- **Development**: Test/sandbox accounts
- **Preview**: Staging credentials
- **Production**: Production credentials with strict access controls

#### 2. Rotate Secrets Regularly
- Rotate API keys every 90 days
- Rotate database passwords every 180 days
- Update CSRF_SECRET periodically
- Document rotation dates

#### 3. Monitor Access
- Enable audit logging for secret access
- Monitor for unauthorized access attempts
- Set up alerts for suspicious activity

#### 4. Backup Secrets Securely
- Store backup copies in a secure password manager (1Password, LastPass, etc.)
- Never store in plain text files
- Encrypt backups at rest

## Secret Generation

### CSRF Secret
\`\`\`bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
\`\`\`

### JWT Secret
\`\`\`bash
openssl rand -base64 32
\`\`\`

### API Keys
- Generate through respective service dashboards
- Use service-specific key generation tools
- Never reuse keys across services

## Troubleshooting

### Missing Environment Variables

**Error**: `Invalid environment variables: CSRF_SECRET is required`

**Solution**:
1. Check `.env.local` exists and contains the variable
2. Verify variable name matches exactly (case-sensitive)
3. Ensure no extra spaces or quotes
4. Restart development server after changes

### Invalid Variable Format

**Error**: `SUPABASE_URL must be a valid URL`

**Solution**:
1. Verify URL format: `https://your-project.supabase.co`
2. Check for typos in the URL
3. Ensure no trailing slashes or spaces

### Production Deployment Failures

**Error**: `Production deployment missing critical environment variables`

**Solution**:
1. Go to Vercel project settings
2. Add missing variables to Production environment
3. Redeploy the application

## Security Checklist

- [ ] All secrets stored in environment variables
- [ ] `.env.local` added to `.gitignore`
- [ ] No secrets committed to version control
- [ ] Production uses different credentials than development
- [ ] Secrets backed up securely
- [ ] API keys have minimal required permissions
- [ ] Regular secret rotation schedule established
- [ ] Monitoring and alerting configured
- [ ] Team members trained on secret management
- [ ] Incident response plan for compromised secrets

## Incident Response

### If a Secret is Compromised

1. **Immediate Actions**
   - Revoke the compromised secret immediately
   - Generate a new secret
   - Update all environments with new secret
   - Deploy updated configuration

2. **Investigation**
   - Determine how the secret was exposed
   - Check access logs for unauthorized usage
   - Assess potential damage

3. **Prevention**
   - Fix the vulnerability that led to exposure
   - Update security procedures
   - Train team on lessons learned

4. **Documentation**
   - Document the incident
   - Record actions taken
   - Update security policies

## Additional Resources

- [Vercel Environment Variables Documentation](https://vercel.com/docs/concepts/projects/environment-variables)
- [Supabase Security Best Practices](https://supabase.com/docs/guides/platform/security)
- [OWASP Secrets Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)

---

**Last Updated**: January 2025
**Version**: 1.0.0

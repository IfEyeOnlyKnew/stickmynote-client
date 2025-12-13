# Stick My Note - Production Deployment Guide

## Overview
This guide covers deploying Stick My Note to production on the stickmynote.com domain with GoDaddy hosting.

## Pre-Deployment Checklist

### 1. Environment Variables
Ensure all required environment variables are set in your production environment:

**Supabase Configuration:**
- `SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_URL` - Same as above (public)
- `SUPABASE_ANON_KEY` - Supabase anonymous key
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Same as above (public)
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (server-side only)
- `SUPABASE_JWT_SECRET` - JWT secret for token verification

**Database Configuration:**
- `POSTGRES_URL` - Full PostgreSQL connection string
- `POSTGRES_PRISMA_URL` - Prisma-compatible connection string
- `POSTGRES_URL_NON_POOLING` - Direct connection string
- `POSTGRES_USER` - Database username
- `POSTGRES_PASSWORD` - Database password
- `POSTGRES_DATABASE` - Database name
- `POSTGRES_HOST` - Database host

**Application Configuration:**
- `NEXT_PUBLIC_SITE_URL` - https://www.stickmynote.com
- `LOGIN_ACCESS_CODE` - Access code for login (if used)
- `CSRF_SECRET` - CSRF protection secret
- `XAI_API_KEY` - Grok AI API key for tag generation
- `RESEND_API_KEY` - Email service API key
- `RESEND_FROM_EMAIL` - From email address
- `BLOB_READ_WRITE_TOKEN` - Vercel Blob storage token

**Redis Configuration:**
- `UPSTASH_REDIS_REST_URL` - Redis REST URL
- `UPSTASH_REDIS_REST_TOKEN` - Redis REST token
- `KV_URL` - KV store URL
- `KV_REST_API_URL` - KV REST API URL
- `KV_REST_API_TOKEN` - KV REST API token
- `KV_REST_API_READ_ONLY_TOKEN` - KV read-only token
- `REDIS_URL` - Redis connection URL

**Rate Limiting:**
- `RATE_LIMIT_FORCE_MEMORY` - Force memory-based rate limiting
- `DISABLE_RATE_LIMIT_REDIS` - Disable Redis rate limiting

**Build Configuration:**
- `BUILD_STANDALONE` - Set to "true" for standalone builds
- `BUILD_ID` - Build identifier

### 2. Database Schema Verification
Ensure your Supabase database has all required tables:

**Core Tables:**
- `users` - User profiles and settings
- `notes` - Main notes table with title, topic, content, etc.
- `replies` - Note replies/comments
- `note_tabs` - Extended note data (tags, images, videos)

**Multi-Pak Tables:**
- `multi_paks` - Team/group containers
- `multi_pak_members` - Team membership
- `multi_pak_pending_invites` - Pending invitations
- `pads` - Collaborative workspaces
- `pad_members` - Pad membership
- `pad_pending_invites` - Pending pad invitations
- `sticks` - Collaborative notes
- `stick_members` - Stick access control
- `stick_replies` - Stick comments
- `stick_tabs` - Extended stick data
- `stick_tags` - Stick categorization

**System Tables:**
- `audit_logs` - System audit trail
- `rate_limits` - Rate limiting data
- `system_metrics` - Performance metrics
- `user_id_mismatch_log` - User consistency tracking
- `saved_emails` - Email management
- `visible_pads` - Public pad visibility
- `visible_pads_expanded` - Extended pad visibility

### 3. Row Level Security (RLS)
Verify RLS policies are enabled on all tables:
- Users can only access their own data
- Shared notes are accessible based on sharing settings
- Multi-Pak members can access team resources
- Admin functions are properly restricted

### 4. TypeScript Compilation
Run type checking to ensure no TypeScript errors:
\`\`\`bash
npm run type-check
\`\`\`

### 5. Build Test
Test the production build locally:
\`\`\`bash
npm run build
npm start
\`\`\`

## Deployment Steps

### 1. Domain Configuration
**GoDaddy DNS Settings:**
- Point your domain to Vercel's nameservers or configure A/CNAME records
- Ensure SSL certificate is properly configured
- Set up www redirect if needed

### 2. Vercel Deployment
**Project Settings:**
- Framework Preset: Next.js
- Build Command: `npm run build`
- Output Directory: `.next`
- Install Command: `npm install`
- Development Command: `npm run dev`

**Environment Variables:**
- Add all environment variables listed above
- Ensure sensitive keys are marked as sensitive
- Verify public variables are properly prefixed with `NEXT_PUBLIC_`

**Domain Configuration:**
- Add stickmynote.com as custom domain
- Configure www.stickmynote.com as primary domain
- Enable automatic HTTPS

### 3. Database Migration
**Supabase Setup:**
- Ensure all tables exist with proper schema
- Verify RLS policies are active
- Test database connections
- Run any pending migrations

### 4. Integration Testing
**Supabase Integration:**
- Test user authentication
- Verify note CRUD operations
- Check real-time subscriptions
- Test file uploads to Blob storage

**External Services:**
- Verify Grok AI integration for tag generation
- Test email sending via Resend
- Check Redis/Upstash connectivity
- Validate rate limiting functionality

### 5. Performance Optimization
**Caching:**
- Verify CDN caching is working
- Check API response caching
- Test static asset caching

**Monitoring:**
- Set up error tracking
- Configure performance monitoring
- Enable analytics

## Post-Deployment Verification

### 1. Functional Testing
- [ ] User registration and login
- [ ] Email verification flow
- [ ] Note creation, editing, deletion
- [ ] Note sharing functionality
- [ ] Reply system
- [ ] Tag generation
- [ ] Multi-Pak team features
- [ ] File upload and management
- [ ] Search functionality
- [ ] Mobile responsiveness

### 2. Performance Testing
- [ ] Page load times < 3 seconds
- [ ] API response times < 500ms
- [ ] Database query performance
- [ ] CDN asset delivery
- [ ] Mobile performance scores

### 3. Security Testing
- [ ] HTTPS enforcement
- [ ] CSP headers active
- [ ] XSS protection enabled
- [ ] CSRF protection working
- [ ] Rate limiting functional
- [ ] Authentication security
- [ ] Data access controls

### 4. SEO Verification
- [ ] Meta tags properly set
- [ ] Sitemap accessible
- [ ] Robots.txt configured
- [ ] Structured data markup
- [ ] Open Graph tags
- [ ] Canonical URLs

## Monitoring and Maintenance

### 1. Error Monitoring
- Set up Vercel error tracking
- Monitor Supabase logs
- Track API error rates
- Set up alerting for critical issues

### 2. Performance Monitoring
- Monitor Core Web Vitals
- Track API response times
- Monitor database performance
- Watch memory and CPU usage

### 3. Security Monitoring
- Monitor authentication failures
- Track rate limit violations
- Watch for suspicious activity
- Regular security audits

### 4. Backup Strategy
- Supabase automatic backups
- Regular database exports
- Code repository backups
- Environment variable backups

## Troubleshooting

### Common Issues

**Build Failures:**
- Check TypeScript errors: `npm run type-check`
- Verify all dependencies are installed
- Check environment variable availability
- Review build logs for specific errors

**Database Connection Issues:**
- Verify Supabase credentials
- Check network connectivity
- Validate connection strings
- Test RLS policies

**Authentication Problems:**
- Check Supabase auth configuration
- Verify JWT secrets
- Test email delivery
- Check redirect URLs

**Performance Issues:**
- Review database query performance
- Check CDN configuration
- Monitor API response times
- Optimize image delivery

### Support Contacts
- Vercel Support: vercel.com/help
- Supabase Support: supabase.com/support
- GoDaddy Support: godaddy.com/help

## Rollback Plan
1. Keep previous deployment available
2. Database rollback procedures
3. DNS rollback if needed
4. Environment variable restoration
5. Communication plan for users

---

**Last Updated:** January 2025
**Version:** 1.0.0
**Domain:** https://www.stickmynote.com

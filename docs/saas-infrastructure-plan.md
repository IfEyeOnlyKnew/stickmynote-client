# StickyMyNote SaaS Infrastructure Plan

This document outlines the infrastructure strategy for scaling StickyMyNote from an on-premise Windows deployment to a multi-tenant SaaS product supporting ~60,000 company users.

## Current Architecture (On-Premise Windows)

| Server | IP Address | Role |
|--------|------------|------|
| WIN-R0HEEUG88NH | 192.168.50.11 | Domain Controller, DNS Server |
| HOL-DC2-IIS | 192.168.50.20 | Application Server (StickyMyNote) |
| HOL-DC3-PGSQL | 192.168.50.30 | PostgreSQL Database Server |
| HOL-DC5-REDIS | 192.168.50.50 | Memcached Server |
| HOL-DC6-LIVE | 192.168.50.80 | LiveKit Video Server (Caddy TLS on :7443) |
| HOL-OLLAMA | 192.168.50.70 | Ollama AI Server |

---

## Linux Migration

### Recommended Distribution

**Ubuntu Server 22.04 LTS** (or 24.04 LTS) — widest community support for Node.js, PostgreSQL, LiveKit, and Caddy. LTS provides 5 years of security updates.

**Alternatives:** Debian 12 (more minimal), Rocky Linux 9 / AlmaLinux 9 (RHEL-family).

### What Changes Moving to Linux

| Current (Windows) | Linux Equivalent |
|---|---|
| Windows Service (`net start/stop StickyMyNote`) | systemd unit file (`systemctl start/stop stickmynote`) |
| PowerShell deploy scripts | Bash scripts |
| `C:\stick-my-note-prod\...` paths | `/opt/stickmynote/` or `/srv/stickmynote/` |
| `C:\LiveKit\certs\` | `/etc/livekit/certs/` or `/etc/ssl/certs/` |
| Task Manager / `taskkill` | `systemctl` / `kill` |
| Windows DNS Server on DC | BIND9 or `/etc/hosts` / external DNS |

### What Stays the Same (No Code Changes)

- All Next.js application code
- `server.js` (Node.js HTTPS server works identically)
- PostgreSQL queries and schema
- WebSocket infrastructure
- LiveKit integration
- Memcached client code
- `pnpm install` / `pnpm run build`

### Consolidated Linux Setup (Small Scale)

For a small deployment, everything except LiveKit can run on a **single Ubuntu server** with 4+ cores and 8+ GB RAM. LiveKit should stay on its own box due to media processing load.

---

## Capacity Estimates

### Single Ubuntu Server (4 cores, 8 GB RAM) — App + PostgreSQL + Memcached

| Metric | Estimate |
|---|---|
| Concurrent users (browsing) | ~200–500 |
| Concurrent WebSocket connections | ~1,000–2,000 |
| Registered user accounts | Thousands (DB-limited, essentially unlimited) |
| Concurrent video calls (on separate LiveKit box) | ~10–20 rooms of 4–6 people |

### What Hits Limits First

1. **WebSocket connections** — each holds ~50KB of memory. 2,000 connections ≈ 100MB. Node.js single-process handles this fine, but you'd eventually want clustering.
2. **Next.js SSR** — server-side rendering is CPU-bound. Heavy page loads under high concurrency will slow down before anything else.
3. **PostgreSQL on same box** — shared CPU/RAM with the app. This is the first thing to split off if you need more headroom.
4. **LiveKit** — video is the heaviest resource. A 4-core box handles ~50 participants total across all rooms.

### Scaling Steps

| Users | Setup |
|---|---|
| <200 concurrent | Single server + separate LiveKit box |
| 200–1,000 | Split PostgreSQL to its own server |
| 1,000–5,000 | Add Node.js clustering (PM2), dedicated Memcached |
| 5,000+ | Load balancer + multiple app servers, DB replicas |

A single Ubuntu server (plus the LiveKit box) would comfortably handle **50–100 daily active users** without breaking a sweat.

---

## SaaS Architecture (60,000 Users)

### Identity Management — Drop Active Directory

At 60,000 users across multiple companies, you don't manage their identities — customers bring their own IdP. The existing SSO/OIDC implementation (`identity_providers` + `federated_identities` tables) already supports this pattern.

| Approach | What It Does | Cost |
|---|---|---|
| **Auth0** or **Clerk** | Managed auth — email/password, social login, MFA, SSO federation | ~$1–3/user/month |
| **AWS Cognito** | Cheaper managed auth, rougher developer experience | ~$0.0055/MAU after free tier |
| **Keycloak** (self-hosted) | Open-source IdP, federates with customer Azure AD/Okta/Google | Free but self-maintained |

**How it works for enterprise customers:**
- Company signs up → admin connects their Azure AD / Okta / Google Workspace via OIDC
- The existing OIDC code maps directly to Auth0/Clerk enterprise SSO features
- Non-SSO users (email/password signups) are handled by the managed auth service

**Recommendation:** Auth0 or Clerk for the auth layer. No Windows AD anywhere.

### Email — Self-Hosted (Postfix + Dovecot)

All email stays in-house. No third-party services, full control over data.

| Component | Purpose |
|---|---|
| **Postfix** | SMTP — sending and receiving email |
| **Dovecot** | IMAP — reading mail via clients (Outlook, Thunderbird) |
| **OpenDKIM** | Email signing — prevents spam flagging |
| **SpamAssassin** | Inbound spam filtering |
| **Let's Encrypt** | TLS certificate for mail.stickmynote.com |

**DNS requirements:** MX, SPF, DKIM, DMARC records + reverse DNS (PTR) from Hostinger.

**App integration:** Zero code changes — existing Nodemailer sends through `localhost:25`.

Setup script: `C:\stick-my-note-ubuntu\stickmynote-client\scripts\setup-mailserver.sh`

### Cloud Infrastructure

```
                    ┌─────────────┐
                    │ Cloudflare  │
                    │   CDN/WAF   │
                    └──────┬──────┘
                           │
                    ┌──────┴──────┐
                    │    Load     │
                    │  Balancer   │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
        ┌─────┴─────┐ ┌───┴───┐ ┌─────┴─────┐
        │  App (K8s) │ │  App  │ │    App    │
        │  3-6 pods  │ │  pod  │ │    pod    │
        └─────┬──────┘ └───┬───┘ └─────┴─────┘
              │            │            │
    ┌─────────┼────────────┼────────────┘
    │         │            │
┌───┴───┐ ┌──┴───┐ ┌──────┴──────┐
│ PG RDS│ │Redis │ │  LiveKit    │
│Primary│ │Cluster│ │  Cloud /    │
│+Replica│ │      │ │  Self-host  │
└───────┘ └──────┘ └─────────────┘
```

| Component | Service | Why |
|---|---|---|
| **Hosting** | AWS (ECS/EKS) or Vercel | Vercel is easiest for Next.js; AWS for full control |
| **Database** | AWS RDS PostgreSQL or Neon | Managed, auto-backups, read replicas |
| **Cache** | Redis (ElastiCache) | Replace Memcached — need pub/sub for multi-server WebSockets |
| **WebSockets** | Redis pub/sub + multiple Node processes | Can't use `globalThis.__wsBroadcast` across servers |
| **Video** | LiveKit Cloud or self-hosted cluster | LiveKit offers managed SFU hosting |
| **Auth** | Auth0 / Clerk | Federated SSO for enterprise customers |
| **Email** | Postmark / SendGrid | Transactional email via API |
| **File uploads** | S3 + CloudFront | Replace local `public/uploads/` — required for multi-server |

### Why Not Stay on Windows?

- Windows Server licensing alone would cost tens of thousands per year
- Every cloud/SaaS tool assumes Linux containers
- Kubernetes, Docker, CI/CD pipelines are all Linux-native
- The application code needs zero changes to run on Linux

---

## Code Changes Required for SaaS

The application is mostly ready, but a few things need reworking for multi-server SaaS:

1. **File uploads** → S3 (can't use local disk across multiple servers)
2. **WebSocket broadcast** → Redis pub/sub instead of `globalThis.__wsBroadcast`
3. **Auth** → Integrate Auth0/Clerk SDK instead of custom password tables
4. **Multi-tenancy** → Organizations already exist; needs tenant isolation review
5. **`server.js`** → Likely replaced by Vercel's hosting or a Dockerfile

---

## Hosting Provider: Hostinger KVM 2

Selected plan for initial SaaS deployment:

| Spec | Value |
|---|---|
| **Plan** | Hostinger KVM 2 |
| **Cost** | $8.99/month (renews at $14.99/month) |
| **vCPUs** | 2 |
| **RAM** | 8 GB |
| **Storage** | 100 GB NVMe |
| **Bandwidth** | 8 TB |
| **OS** | Ubuntu Server 24.04 LTS (AMD64) |

### Why KVM 2

- 2 vCPUs handle Next.js SSR + background tasks (WebSockets, DB queries) without bottlenecking
- 8 GB RAM fits Node.js + PostgreSQL + Redis + LiveKit on one box
- 100 GB NVMe is plenty for app, database, and user uploads
- Upgrade path to KVM 4 ($12.99/mo, 4 vCPU, 16 GB) when needed — no migration required

### Deployment Files

All Ubuntu deployment scripts and configuration files are maintained in:

```text
C:\stick-my-note-ubuntu\stickmynote-client\
├── scripts/
│   ├── setup-server.sh      # One-time Ubuntu setup
│   ├── setup-livekit.sh     # LiveKit SFU install
│   ├── setup-mailserver.sh  # Postfix + Dovecot + OpenDKIM mail server
│   ├── add-mail-user.sh     # Add email accounts
│   ├── deploy.sh            # Repeatable deploy (pull, build, restart)
│   └── migrate-db.sh        # PostgreSQL export/import
├── config/
│   ├── stickmynote.service  # systemd service file
│   ├── Caddyfile            # Reverse proxy + automatic SSL
│   └── .env.template        # Environment variable template
├── server.js                # Ubuntu server.js (HTTP on :3000, Caddy handles SSL)
└── docs/
    └── ubuntu-vps-setup.md  # Full step-by-step setup guide
```

### Key Differences from Windows Production

| Aspect | Windows (Current) | Ubuntu (Hostinger) |
|---|---|---|
| SSL/TLS | Node.js HTTPS on port 443 with manual certs | Caddy auto-provisions Let's Encrypt certs |
| Service management | Windows Service (`net start/stop`) | systemd (`systemctl start/stop`) |
| App port | 443 (HTTPS) / 80 (HTTP redirect) | 3000 (HTTP, behind Caddy) |
| server.js | Handles HTTPS directly | Plain HTTP (Caddy terminates SSL) |
| Database | Remote server (192.168.50.30) | localhost (same VPS) |
| Cache | Remote Memcached (192.168.50.50) | localhost Redis |

---

## Realistic Migration Path

| Phase | What | Cost |
|---|---|---|
| **Now** | Keep building features on Windows, it works fine | $0 |
| **Pre-launch** | Deploy to Hostinger KVM 2, migrate database | $8.99/month |
| **0–1,000 users** | Single VPS handles everything | $8.99/month |
| **1,000+ users** | Upgrade to KVM 4 (4 vCPU, 16 GB) | $12.99/month |
| **5,000+ users** | Split DB to managed PostgreSQL, add second app server | ~$50–100/month |
| **10,000–60,000** | Kubernetes or Vercel + RDS + Redis cluster + LiveKit Cloud | Cloud pricing |

> **Key takeaway:** Don't over-invest in infrastructure before you have paying customers. The Hostinger KVM 2 at $8.99/month handles the first thousand+ users easily.

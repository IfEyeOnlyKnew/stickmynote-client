<p align="center">
  <img src="public/icon.svg" alt="Stick My Note" width="80" height="80" />
</p>

<h1 align="center">Stick My Note</h1>

<p align="center">
  <strong>Your Digital Sticky Note Board — Reimagined for Teams</strong>
</p>

<p align="center">
  A full-featured, enterprise-grade collaborative workspace that brings sticky notes, project management, real-time collaboration, AI assistance, and video calling into one unified platform.
</p>

<p align="center">
  <a href="https://www.stickmynote.com">Website</a> &bull;
  <a href="#features">Features</a> &bull;
  <a href="#tech-stack">Tech Stack</a> &bull;
  <a href="#getting-started">Getting Started</a> &bull;
  <a href="#architecture">Architecture</a>
</p>

---

## What is Stick My Note?

Stick My Note started as a simple idea — a digital sticky note board — and evolved into a comprehensive collaboration platform. It combines the simplicity of sticky notes with the power of modern project management, real-time editing, AI-powered intelligence, and enterprise security.

Whether you're a solo thinker jotting down ideas or an enterprise team managing complex projects with Kanban boards and Gantt charts, Stick My Note scales to fit your workflow.

---

## Features

### Sticky Notes & Rich Text Editing
- Create, organize, and color-code sticky notes across customizable boards
- Full rich text editor powered by **Tiptap** with markdown support, code blocks, tables, images, and links
- Drag-and-drop organization with tab-based collections
- 12+ color palette options for visual categorization
- Fullscreen editing mode for focused writing

### Pads — Collaborative Workspaces
- Shared workspaces where teams create, discuss, and manage content together
- Role-based access control: **Owner**, **Editor**, **Viewer**, **Commenter**
- Invite members via email, link, or CSV bulk import
- Public and private visibility settings
- Pad-level analytics and activity tracking
- Automated cleanup policies for workspace hygiene

### Sticks — Task & Project Management
- Create tasks with descriptions, priorities, due dates, tags, and subtasks
- Status tracking across customizable workflows
- Threaded discussions and reply chains on every task
- Promote and demote sticks through workflow stages
- Time tracking with timesheet views

### CalSticks — Advanced Project Management
- **Kanban Boards** — Customizable swimlanes, WIP limits, and card aging visualization
- **Gantt Charts** — Interactive scheduling with drag-and-drop and critical path analysis
- **Budget Tracking** — Allocation and spend tracking per project
- **Portfolio View** — Multi-project overview for leadership
- **Workload Management** — Resource allocation and capacity planning
- **Intake Forms** — Custom form builders for project intake workflows
- **Timesheets** — Time entry logging and reporting

### Real-Time Collaboration
- Concurrent editing with **Yjs** CRDT-based conflict resolution
- Live presence indicators — see who's viewing and editing
- Automatic merge with no conflicts, ever
- Threaded replies and discussion chains on notes and tasks

### AI-Powered Intelligence
- **Auto-Tag Generation** — AI suggests relevant tags from your content
- **Content Summarization** — Summarize long notes and threads instantly
- **Duplicate Detection** — AI identifies similar content to reduce redundancy
- **Smart Reply Suggestions** — Context-aware reply recommendations
- **Subtask Generation** — Automatically break tasks into actionable steps
- **Session Queries** — Ask questions about your workspace knowledge base
- Supports **Ollama** (local/private), **Anthropic Claude**, **Azure OpenAI**, and **OpenAI-compatible** providers

### Social Hub & Community
- Community-style content sharing across your organization
- Activity feeds, notifications, and follow/unfollow
- Hubs for topic-based organization
- Draft management for work-in-progress content
- Moderation dashboard with admin controls and cleanup policies

### Video Calling & Meetings
- Built-in video rooms powered by **Daily.co**
- Create, join, and manage video calls without leaving the platform
- Screen sharing and meeting management

### Search & Discovery
- Full-text search with fuzzy matching for typo tolerance
- Advanced filters and saved search presets
- Search analytics and statistics dashboard
- Multi-index search across notes, sticks, and pads

### Organization & Team Management
- Multi-tenant architecture with isolated organization data
- Member management with role-based permissions
- Self-service access request workflows
- Custom domain configuration per organization
- Organization-level branding and white-labeling
- Contact directory with member profiles

### Enterprise Security
- **LDAP / Active Directory** integration for enterprise single sign-on
- **Two-Factor Authentication (2FA)** with TOTP, QR codes, and backup codes
- Organization-wide **2FA enforcement** with compliance tracking dashboard
- Brute-force protection with configurable account lockout
- **Row-Level Security (RLS)** in PostgreSQL for data isolation
- Content sanitization with **DOMPurify** to prevent XSS
- Secure password hashing with **bcrypt**
- Cookie-based session management

### Export & Integrations
- Export to **DOCX**, **PDF**, and **CSV**
- Print-friendly layouts for any note or task
- Outbound **Webhooks** with delivery logging and debugging
- Escalation rules for automated alert workflows
- Email notifications via **Resend** and **Nodemailer**

---

## Tech Stack

### Frontend

| Technology | Purpose |
|------------|---------|
| **Next.js 14** | React framework with App Router |
| **React 19** | UI library |
| **TypeScript** | Type-safe development |
| **Tailwind CSS** | Utility-first styling |
| **Radix UI** | Accessible, unstyled component primitives (20+ modules) |
| **shadcn/ui** | Beautiful component library built on Radix |
| **Tiptap** | Rich text editor with collaborative editing extensions |
| **Yjs** | CRDT for real-time conflict-free collaboration |
| **Jotai** | Lightweight atomic state management |
| **Lucide React** | Icon library |
| **React Hook Form + Zod** | Form handling and schema validation |
| **Recharts** | Data visualization and charts |
| **Embla Carousel** | Carousel components |

### Backend

| Technology | Purpose |
|------------|---------|
| **Node.js** | Server runtime |
| **PostgreSQL** | Primary database with Row-Level Security |
| **ldapjs** | Enterprise LDAP/Active Directory authentication |
| **bcryptjs** | Secure password hashing |
| **jose** | JWT token management |
| **otpauth** | TOTP-based two-factor authentication |
| **Sharp** | High-performance image processing |
| **Nodemailer + Resend** | Transactional email delivery |
| **Daily.co** | Video calling infrastructure |
| **docx / jspdf** | Document generation (DOCX & PDF) |

### Quality & Tooling

| Technology | Purpose |
|------------|---------|
| **Jest** | Unit and component testing |
| **ESLint** | Code linting with Next.js preset |
| **pnpm** | Fast, disk-efficient package manager |
| **Bundle Analyzer** | Build optimization |
| **T3 Env** | Type-safe environment variable validation |

---

## Getting Started

### Prerequisites

- **Node.js** 20.x or later
- **pnpm** 8.x or later
- **PostgreSQL** 14+ database server

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/stick-my-note.git
cd stick-my-note

# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env.local

# Run the development server
pnpm dev
```

The application will be available at `http://localhost:3000`.

### Environment Variables

Create a `.env.local` file with the following required variables:

```env
# Database
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DATABASE=stickmynote
POSTGRES_USER=your_user
POSTGRES_PASSWORD=your_password

# Authentication
AUTH_SECRET=your_random_secret_key

# Site URL
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

**Optional integrations:**

```env
# AI Providers (configure one or more)
ANTHROPIC_API_KEY=your_key
AZURE_OPENAI_KEY=your_key
OPENAI_API_KEY=your_key
OLLAMA_BASE_URL=http://localhost:11434

# LDAP / Active Directory
LDAP_URL=ldap://your-dc:389
LDAP_BASE_DN=dc=example,dc=com
LDAP_BIND_DN=cn=admin,dc=example,dc=com
LDAP_BIND_PASSWORD=your_password

# Email
RESEND_API_KEY=your_key

# Video Calling
DAILY_API_KEY=your_key
```

### Available Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start the development server |
| `pnpm build` | Build for production |
| `pnpm start` | Start the production server |
| `pnpm lint` | Run ESLint |
| `pnpm test` | Run Jest test suite |
| `pnpm test:db` | Test database connectivity |
| `pnpm test:security` | Run Row-Level Security tests |
| `pnpm health-check` | Verify the application is running |

---

## Architecture

### Application Structure

```
app/
├── auth/                  # Authentication pages (login, register, 2FA, password reset)
├── personal/              # Personal workspace
├── mysticks/              # Personal task board
├── mypads/                # Personal pad collection
├── quicksticks/           # Quick note creation
├── calsticks/             # Advanced project management (Kanban, Gantt, Budget, etc.)
├── social/                # Community hub, shared pads, activity feeds
├── chats/                 # Chat threads
├── video/                 # Video calling
├── search/                # Search interface
├── settings/              # Organization & security settings
├── dashboard/             # Analytics dashboard
├── control-panel/         # Admin control panel
├── api/                   # 500+ API routes
│   ├── auth/              # Authentication & 2FA endpoints
│   ├── ai/                # AI-powered features
│   ├── notes/             # Note CRUD operations
│   ├── sticks/            # Task management
│   ├── social-pads/       # Collaborative workspace APIs
│   ├── organizations/     # Organization management
│   ├── search/            # Search endpoints
│   ├── webhooks/          # Webhook configuration & delivery
│   ├── video/             # Video room management
│   └── health/            # Health check
components/                # 70+ React components
hooks/                     # 70+ custom React hooks
lib/                       # Server-side utilities, database, auth, AI
types/                     # TypeScript type definitions
public/                    # Static assets and branding
```

### Network Architecture

Stick My Note is designed for self-hosted enterprise deployments:

| Server | Role |
|--------|------|
| **Application Server** | Next.js application with HTTPS |
| **Database Server** | PostgreSQL with Row-Level Security |
| **Cache Server** | In-memory caching for sessions and sync |
| **AI Server** | Ollama for private, local LLM inference |
| **DNS / Domain Controller** | Active Directory & DNS resolution |

### Key Design Decisions

- **No internal fetch() for API-to-API calls** — Direct function imports prevent TLS issues in production with Node.js 22+
- **CRDT-based collaboration** — Yjs ensures conflict-free concurrent editing without a central authority
- **Row-Level Security** — PostgreSQL RLS enforces data isolation at the database level, not just the application layer
- **Multi-provider AI** — Swap between Ollama (private), Anthropic, Azure, or OpenAI without code changes
- **Selective deployment** — Production updates use targeted `git checkout` to protect server configuration files

---

## Deployment

### Production Build

```bash
# Build the application
pnpm build

# Start with the custom HTTPS server
pnpm start
```

### Production Considerations

- The production server uses a custom `server.js` with HTTPS and SSL certificates
- Environment variables are managed through `.env` and `.env.production` (never `.env.local` in production)
- The application runs as a Windows Service for high availability
- Health checks are available at `/api/health`

See [CLAUDE.md](CLAUDE.md) for the complete production deployment workflow.

---

## API Overview

Stick My Note exposes **500+ REST API routes** organized across these domains:

| Domain | Routes | Description |
|--------|--------|-------------|
| Authentication | 15+ | Sign in, sign up, 2FA, password reset, lockout |
| Notes | 10+ | CRUD, tagging, export |
| Sticks | 15+ | Tasks, workflow, promotion, export |
| Pads | 10+ | Workspaces, permissions, cleanup, analytics |
| Organizations | 20+ | Members, invites, domains, branding, 2FA policy |
| AI | 7 | Tags, summarize, duplicates, subtasks, replies |
| Search | 5+ | Full-text, filters, analytics |
| CalSticks | 10+ | Kanban, Gantt, budget, workload, timesheets |
| Video | 2+ | Room creation and management |
| Webhooks | 4+ | Configuration, delivery, logging |
| Admin | 5+ | AD sync, user management, moderation |
| System | 3 | Health check, sitemap, robots |

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

This project is private and proprietary. All rights reserved.

---

<p align="center">
  Built with care by the <strong>Stick My Note</strong> team
  <br />
  <a href="https://www.stickmynote.com">stickmynote.com</a>
</p>

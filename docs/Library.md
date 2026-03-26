# Library Feature

File storage and sharing for each StickyMyNote hub, replacing Microsoft 365 equivalents:

| Hub | Replaces | Library Type | Scope |
|-----|----------|-------------|-------|
| **Concur** | Engage (Viva Engage / Yammer) + OneDrive | Personal library per user | Each user owns their own library |
| **Alliance** | OneNote | Pad-level library | Each Pad has its own shared library |
| **Inference** | MS Teams | Hub-level library | Each Inference Pad has its own shared library |

## Permission Model

Library permissions **inherit from the parent resource** -- no new permission system is needed. The role a user already has on the stick, pad, or hub determines their library access.

### Concur (Personal Library)

| User | View | Upload | Delete Own | Delete Any | Manage |
|------|------|--------|------------|------------|--------|
| **Library owner** (the user themselves) | Yes | Yes | Yes | Yes | Yes |
| **Shared group member** (same Concur group) | Yes | - | - | - | - |

### Alliance (Pad Library)

| Pad Role | View | Upload | Delete Own | Delete Any | Manage |
|----------|------|--------|------------|------------|--------|
| **Owner** | Yes | Yes | Yes | Yes | Yes |
| **Admin** | Yes | Yes | Yes | Yes | Yes |
| **Editor** | Yes | Yes | Yes | - | - |
| **Viewer** | Yes | - | - | - | - |

### Inference (Hub Library)

| Pad Role | View | Upload | Delete Own | Delete Any | Manage |
|----------|------|--------|------------|------------|--------|
| **Owner** | Yes | Yes | Yes | Yes | Yes |
| **Admin** | Yes | Yes | Yes | Yes | Yes |
| **Editor** | Yes | Yes | Yes | - | - |
| **Contributor** | Yes | Yes | - | - | - |
| **Viewer** | Yes | - | - | - | - |

## Architecture

### Database

**Migration:** `scripts/windows-server/60-create-library-tables.sql`

Two tables:

- **`library_files`** -- File metadata (filename, path, size, MIME type, uploader, scope)
- **`library_folders`** -- Optional folder organization within a library

The `scope_type` + `scope_id` columns link each file to its parent resource:

| scope_type | scope_id points to | Example |
|------------|-------------------|---------|
| `concur_user` | `users.id` | A user's personal library |
| `alliance_pad` | `paks_pads.id` | An Alliance Pad's library |
| `inference_pad` | `social_pads.id` | An Inference Pad's library |

### File Storage

Files are stored on disk under:

```
uploads/library/{scope_type}/{scope_id}/{uuid}-{filename}
```

- Served by `server.js` via the existing `/uploads/*` handler
- No encryption (library files follow the same pattern as other uploads)
- 50MB max file size per upload

### Supported File Types

| Category | Extensions |
|----------|-----------|
| Images | JPEG, PNG, GIF, WebP, SVG |
| Documents | PDF, DOC, DOCX |
| Spreadsheets | XLS, XLSX, CSV |
| Presentations | PPT, PPTX |
| Text | TXT |
| Archives | ZIP |
| Video | MP4, WebM |
| Audio | MP3, WAV |

### API Routes

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/library?scopeType=...&scopeId=...` | List files (+ optional `folder` filter) |
| `POST` | `/api/library` | Upload file (FormData: `file`, `scopeType`, `scopeId`, optional `folder`, `description`) |
| `GET` | `/api/library/[fileId]` | Get file metadata |
| `PATCH` | `/api/library/[fileId]` | Update file description or folder |
| `DELETE` | `/api/library/[fileId]` | Delete file (checks permissions) |

### Permission Logic

**File:** `lib/library/library-permissions.ts`

The `checkLibraryPermissions(userId, orgId, scopeType, scopeId)` function returns:

```typescript
{
  allowed: boolean
  permissions: ("view" | "upload" | "delete_own" | "delete_any" | "manage")[]
  role: string  // e.g., "owner", "admin", "editor", "viewer"
}
```

Each scope type queries the appropriate membership table:

- **concur_user:** Checks if user is the library owner, or shares a Concur group
- **alliance_pad:** Checks `paks_pads` ownership + `multi_pak_members` role
- **inference_pad:** Checks `social_pads` ownership + `social_pad_members` role

### UI Components

| Component | File | Description |
|-----------|------|-------------|
| `LibraryPanel` | `components/library/LibraryPanel.tsx` | Reusable file list with upload, search, download, delete |
| `LibraryDialog` | `components/library/LibraryDialog.tsx` | Modal wrapper around LibraryPanel |

### Hub Integration

| Hub | Page | Button Location |
|-----|------|----------------|
| Concur | `app/concur/[groupId]/page.tsx` | Header toolbar (visible to all members) |
| Alliance | `app/pads/[padId]/page-client.tsx` | Header toolbar (visible to all members) |
| Inference | `app/inference/pads/[padId]/page.tsx` | Header toolbar (visible to all members) |

Each page adds a **Library** button (HardDrive icon) that opens the `LibraryDialog` with the appropriate scope.

## Setup

### 1. Run Migration

On HOL-DC3-PGSQL (192.168.50.30):

```sql
\i scripts/windows-server/60-create-library-tables.sql
```

### 2. Server.js MIME Types

The `server.js` MIME types map has been expanded to include Office documents, spreadsheets, presentations, audio, video, CSV, and ZIP files so that library files are served with correct Content-Type headers.

## Dashboard Statement

A replacement statement has been added above the three hub cards on `/dashboard`:

> **Concur** replaces Engage -- **Alliance** replaces OneNote -- **Inference** replaces MS Teams

This helps users understand the mapping between StickyMyNote hubs and the Microsoft 365 tools they replace.

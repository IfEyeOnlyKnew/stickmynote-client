# Library Feature

One unified library where every Stick gets its own file folder. When a user opens a Stick, they see a **Files** tab with the folder contents. Permissions inherit directly from stick ownership.

## Permission Model

Simple two-tier model — no new permission tables needed:

| Role | View/Download | Upload | Delete | Manage |
|------|:---:|:---:|:---:|:---:|
| **Owner** (stick creator, pad owner, group owner) | Yes | Yes | Yes | Yes |
| **Everyone else** with stick access | Yes | - | - | - |

### Per Stick Type

| Stick Type | Owner (Edit) | Viewer (Read-only) |
|-----------|-------------|-------------------|
| **Personal** | Stick creator (`personal_sticks.user_id`) | Users in `personal_sticks_shares` |
| **Concur** | Stick author + Concur group owner | Concur group members |
| **Alliance** | Stick creator + pad owner | Pad members |
| **Inference** | Stick creator + pad owner | Pad members |

## Architecture

### Database

**Tables:** `library_files`, `library_folders` (created in migration 60, altered in migration 61)

Key columns in `library_files`:
- `scope_type` — always `'stick'`
- `scope_id` — the stick's UUID
- `stick_type` — `'personal'`, `'concur'`, `'alliance'`, or `'inference'`

### File Storage

```
uploads/library/sticks/{stickId}/{uuid}-{filename}
```

Served by `server.js` via the existing `/uploads/*` handler. Max 50MB per file.

### Supported File Types

Images, PDF, Office docs (DOC/DOCX, XLS/XLSX, PPT/PPTX), TXT, CSV, ZIP, MP4, WebM, MP3, WAV.

### API Routes

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/library?stickId=...&stickType=...` | List files in a stick's folder |
| `POST` | `/api/library` | Upload file (FormData: `file`, `stickId`, `stickType`) |
| `DELETE` | `/api/library/[fileId]` | Delete file (owner only) |

### Permission Logic

**File:** `lib/library/library-permissions.ts`

`checkStickLibraryPermissions(userId, orgId, stickId, stickType)` returns:
- `role: "owner"` — full edit (upload, delete, manage)
- `role: "viewer"` — read-only (view/download)
- `role: "none"` — no access

### UI Integration

The library is accessible from the **Files** tab inside each stick:

| Stick Type | Where Files Tab Appears |
|-----------|------------------------|
| Personal | `GenericStickTabs` in `PermissionBasedStickFullscreen` (mysticks, quicksticks) |
| Concur | `GenericStickTabs` in `ConcurStickDetailModal` |
| Alliance | `GenericStickTabs` in `PermissionBasedStickFullscreen` (pads) |
| Inference | Files button in `StickDetailModal` header (opens `LibraryDialog`) |

### Key Components

| Component | File | Description |
|-----------|------|-------------|
| `LibraryPanel` | `components/library/LibraryPanel.tsx` | File list with upload, search, download, delete |
| `LibraryDialog` | `components/library/LibraryDialog.tsx` | Modal wrapper around LibraryPanel |
| `GenericStickTabs` | `components/GenericStickTabs.tsx` | Has `stickType` prop; shows Files tab when set |

## Setup

### Run Migrations

On HOL-DC3-PGSQL (192.168.50.30):

```sql
-- If not already run:
\i scripts/windows-server/60-create-library-tables.sql

-- Then alter for stick-scoped model:
\i scripts/windows-server/61-alter-library-to-stick-scope.sql
```

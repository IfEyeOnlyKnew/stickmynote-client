# Noted - OneNote Replacement for Stick My Note

> **Goal:** Eliminate the need for Microsoft OneNote by providing an integrated notebook experience directly within Stick My Note. Every Stick can become a Noted page, organized into groups, with rich text editing and permission-aware visibility.

---

## Overview

**Noted** is a built-in notebook feature that turns any Stick into a full notebook page. It provides a OneNote-style experience with a three-panel layout: group tabs across the top, a page list sidebar on the left, and a rich text editor on the right.

### Why Noted Replaces OneNote

| OneNote Feature | Noted Equivalent |
|----------------|-----------------|
| Notebooks | Groups (tabbed across the top) |
| Sections | Group tabs with color coding |
| Pages | Noted pages (created from Sticks) |
| Rich text editing | Tiptap editor with formatting toolbar |
| Sharing & permissions | Inherits Stick permissions (personal/shared/org) |
| Search | Full-text search across all Noted pages |
| Recent pages | Left sidebar sorted by newest created |
| Page hierarchy | Flat within groups, drag to reorder |

---

## User Flow

### Creating a Noted Page

1. User sees a **Noted icon** (notebook icon) on every Stick card
2. Clicking the icon opens the Noted app at `/noted`
3. A new Noted page is automatically created, linked to that Stick
4. The page title is pre-filled from the Stick's **topic** (editable)
5. The Stick's **content** is copied as the initial page body
6. User can edit the page with rich text formatting

### Viewing & Editing Noted Pages

1. Navigate to `/noted` from the main navigation
2. **Top bar:** Group tabs (All, plus user-created groups)
3. **Left sidebar:** List of Noted pages, newest first, filterable by group
4. **Right panel:** Selected page content in a rich text editor
5. Click any page in the sidebar to view/edit it
6. Auto-save on content change (debounced)

### Grouping Noted Pages

1. Click **"+ New Group"** button in the top tab bar
2. Enter a group name (e.g., "Project Alpha", "Meeting Notes", "Research")
3. Group appears as a new tab
4. Drag pages into groups, or assign via a dropdown on each page
5. Groups can be renamed, reordered, and deleted
6. Deleting a group moves its pages back to "Ungrouped"

---

## Permissions Model

Noted pages inherit permissions from their source Stick:

| Stick Type | Noted Visibility |
|-----------|-----------------|
| **Personal Stick** (from `/personal`) | Only the creator can see the Noted page |
| **Shared Stick** (on a shared Pad) | All Pad members with access can see it |
| **Org Stick** | All org members can see it |

- Permission checks happen at query time — pages are filtered by what the user can access
- If a user loses access to the source Stick (e.g., removed from a Pad), they lose access to the Noted page
- Groups are per-user — each user organizes their own Noted pages into their own groups

---

## Database Schema

### Migration: `49-create-noted-tables.sql`

#### `noted_pages` table

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID PK | Page identifier |
| `stick_id` | UUID FK → `paks_pad_sticks(id)` | Source Stick (nullable for personal sticks) |
| `personal_stick_id` | UUID FK → `personal_sticks(id)` | Source Personal Stick (nullable for pad sticks) |
| `user_id` | UUID FK → `users(id)` | Creator |
| `org_id` | UUID FK → `organizations(id)` | Organization scope |
| `title` | TEXT | Page title (from Stick topic, editable) |
| `content` | TEXT | Rich text content (HTML from Tiptap) |
| `group_id` | UUID FK → `noted_groups(id)` | Optional group assignment |
| `is_personal` | BOOLEAN | True if from a personal stick |
| `source_content` | TEXT | Original Stick content snapshot |
| `created_at` | TIMESTAMPTZ | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | Last edit timestamp |

**Constraints:**
- CHECK: exactly one of `stick_id` or `personal_stick_id` must be non-null
- UNIQUE on `stick_id` (one Noted page per Stick)
- UNIQUE on `personal_stick_id` (one Noted page per Personal Stick)

#### `noted_groups` table

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID PK | Group identifier |
| `user_id` | UUID FK → `users(id)` | Owner (groups are per-user) |
| `org_id` | UUID FK → `organizations(id)` | Organization scope |
| `name` | TEXT | Group name |
| `color` | TEXT | Group tab color (hex) |
| `sort_order` | INTEGER | Display order |
| `created_at` | TIMESTAMPTZ | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | Last edit timestamp |

---

## API Routes

### Noted Pages (`/api/noted/pages`)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/noted/pages` | List all Noted pages (permission-filtered) |
| `POST` | `/api/noted/pages` | Create a Noted page from a Stick |
| `GET` | `/api/noted/pages/[id]` | Get single page with content |
| `PUT` | `/api/noted/pages/[id]` | Update page title/content/group |
| `DELETE` | `/api/noted/pages/[id]` | Delete a Noted page |
| `GET` | `/api/noted/pages/by-stick/[stickId]` | Check if Stick has a Noted page |

### Noted Groups (`/api/noted/groups`)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/noted/groups` | List user's groups |
| `POST` | `/api/noted/groups` | Create a new group |
| `PUT` | `/api/noted/groups/[id]` | Rename/recolor/reorder group |
| `DELETE` | `/api/noted/groups/[id]` | Delete group (pages become ungrouped) |
| `PUT` | `/api/noted/groups/reorder` | Bulk reorder groups |

---

## UI Components

### File Structure

```
app/noted/
  page.tsx                    # Server component (auth + initial data fetch)
  noted-client.tsx            # Main client component (3-panel layout)

components/noted/
  NotedIcon.tsx               # Noted icon button for Stick cards
  NotedPageList.tsx           # Left sidebar - page list with search
  NotedPageEditor.tsx         # Right panel - Tiptap rich text editor
  NotedGroupTabs.tsx          # Top bar - group tabs
  NotedGroupModal.tsx         # Create/edit group dialog
  NotedEmptyState.tsx         # Empty state when no pages exist

hooks/
  useNoted.ts                 # Data fetching, CRUD operations, state management
```

### Layout

```
+------------------------------------------------------------------+
|  [All] [Project Alpha] [Meeting Notes] [Research] [+ New Group]  |  <- Group Tabs
+------------------+-----------------------------------------------+
|                  |                                                |
|  Search...       |  Page Title (editable)                        |
|                  |  ─────────────────────────                    |
|  Meeting Notes   |                                                |
|  Mar 13, 2026    |  B I U S  H1 H2  • 1.  [] ─  📎            |
|  ────────────    |  ─────────────────────────────────────         |
|  Project Plan    |                                                |
|  Mar 12, 2026    |  Rich text content goes here.                 |
|                  |                                                |
|  Research Ideas  |  This is a full notebook page created from     |
|  Mar 11, 2026    |  a Stick. Users can format text, add lists,   |
|                  |  headings, checkboxes, and more.               |
|  Sprint Retro    |                                                |
|  Mar 10, 2026    |  ## Subheading                                |
|                  |  - Bullet point one                           |
|                  |  - Bullet point two                           |
|                  |  - [x] Completed task                         |
|                  |  - [ ] Pending task                           |
+------------------+-----------------------------------------------+
```

### Noted Icon on Sticks

- **Icon:** `BookOpen` from lucide-react (notebook icon)
- **Placement:** Next to existing action buttons (Gantt, Color) on each Stick card
- **Behavior:**
  - If Stick has no Noted page → creates one and navigates to `/noted?page={id}`
  - If Stick already has a Noted page → navigates to `/noted?page={id}`
- **Visual indicator:** Filled icon if already Noted, outline if not

### Rich Text Editor (Tiptap)

Toolbar features:
- **Text formatting:** Bold, Italic, Underline, Strikethrough
- **Headings:** H1, H2, H3
- **Lists:** Bullet list, Numbered list, Task list (checkboxes)
- **Block elements:** Blockquote, Code block, Horizontal rule
- **Inline:** Code, Link, Highlight
- **History:** Undo, Redo

---

## Technical Implementation

### Dependencies to Add

```json
{
  "@tiptap/react": "^2.x",
  "@tiptap/starter-kit": "^2.x",
  "@tiptap/extension-task-list": "^2.x",
  "@tiptap/extension-task-item": "^2.x",
  "@tiptap/extension-highlight": "^2.x",
  "@tiptap/extension-link": "^2.x",
  "@tiptap/extension-underline": "^2.x",
  "@tiptap/extension-placeholder": "^2.x"
}
```

### Auto-save Strategy

- Debounce content changes by 1 second
- Show "Saving..." indicator during save
- Show "Saved" confirmation after successful save
- Optimistic UI — content updates immediately in the editor

### Permission Query Pattern

```sql
-- Get all Noted pages the user can access
SELECT np.*,
  COALESCE(np.title, s.topic, ps.topic) as display_title
FROM noted_pages np
LEFT JOIN paks_pad_sticks s ON s.id = np.stick_id
LEFT JOIN personal_sticks ps ON ps.id = np.personal_stick_id
WHERE np.org_id = $1  -- org isolation
AND (
  -- Personal sticks: only creator
  (np.is_personal = true AND np.user_id = $2)
  OR
  -- Pad sticks: user is pad member or pad owner
  (np.is_personal = false AND EXISTS (
    SELECT 1 FROM paks_pads p
    LEFT JOIN paks_pad_members pm ON pm.pad_id = p.id AND pm.user_id = $2 AND pm.accepted = true
    WHERE p.id = s.pad_id
    AND (p.owner_id = $2 OR pm.id IS NOT NULL)
  ))
)
ORDER BY np.created_at DESC;
```

### WebSocket Integration

- Broadcast `noted:created`, `noted:updated`, `noted:deleted` events
- Real-time page list updates when collaborators create/edit Noted pages
- Use existing `globalThis.__wsBroadcast.sendToOrg()` for org-wide updates

---

## Navigation

- Add "Noted" link to the dashboard page alongside existing feature cards
- Add "Noted" to the mobile bottom nav
- Noted icon accessible from any Stick card across the app (Pads, Personal, Social)

---

## Future Enhancements (Post-MVP)

- **Sub-pages:** Nested pages within a Noted page
- **Templates:** Pre-built page templates (Meeting Notes, Project Plan, etc.)
- **Export:** Export pages as PDF, Markdown, or Word
- **Collaborative editing:** Real-time multi-user editing with cursors
- **Page versioning:** View edit history and restore previous versions
- **Attachments:** Embed images and files directly in pages
- **Quick capture:** Global shortcut to create a Noted page without a Stick
- **Favorites:** Pin frequently used pages to the top
- **Tags:** Tag pages for cross-group organization

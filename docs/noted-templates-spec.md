# Noted Templates - Feature Specification

## Overview

Noted Templates allow users to create new pages from pre-built or custom templates. Templates provide reusable page structures for common workflows like meetings, project briefs, and decision logs.

## Database

**Table:** `noted_templates` (Migration 51)

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | NULL for system templates, user ID for custom |
| org_id | UUID | NULL for system templates, org ID for custom |
| name | TEXT | Template name |
| description | TEXT | Brief description |
| category | TEXT | `meetings`, `projects`, `planning`, `general` |
| content | TEXT | Tiptap HTML content |
| is_system | BOOLEAN | true = built-in, false = user-created |
| sort_order | INTEGER | Display ordering |
| created_at | TIMESTAMPTZ | Created timestamp |
| updated_at | TIMESTAMPTZ | Last modified timestamp |

## System Templates (Seeded)

| # | Name | Category | Description |
|---|------|----------|-------------|
| 1 | Meeting Notes | meetings | Agenda, attendees, discussion, action items |
| 2 | 1:1 Meeting | meetings | Talking points, wins, blockers, follow-ups |
| 3 | Project Brief | projects | Objective, scope, timeline, stakeholders |
| 4 | Decision Log | planning | Decision, context, alternatives, outcome |
| 5 | Weekly Review | planning | Accomplishments, in progress, upcoming, blockers |

System templates are read-only. Users can "Customize" a system template, which clones it as a personal template they can edit freely.

## API Routes

### GET /api/noted/templates

Lists all templates visible to the user (system + user's own).

**Query params:**
- `category` (optional) - Filter by category

**Response:** `{ data: NotedTemplate[] }`

### POST /api/noted/templates

Creates a user template.

**Body:** `{ name, description?, category?, content? }`

**Response:** `{ data: NotedTemplate }` (201)

### GET /api/noted/templates/:id

Fetches a single template (system or user's own).

### PUT /api/noted/templates/:id

Updates a user template. Cannot update system templates.

**Body:** `{ name?, description?, category?, content? }`

### DELETE /api/noted/templates/:id

Deletes a user template. Cannot delete system templates.

## UI Components

### NotedTemplateGallery

Modal dialog opened via "New Page" button in the page list.

- Category tabs: All, Meetings, Projects, Planning, General, My Templates
- Search bar to filter by name/description
- 2-column grid of template cards with preview panel
- Each card shows: name, category badge, description, Use/Customize/Edit/Delete buttons
- "Blank Page" button creates an empty page without a template
- "Create Template" button opens the template editor

### NotedTemplateEditor

Dialog for creating or editing a template.

- Name input
- Description textarea
- Category dropdown
- Tiptap rich text editor (same extensions as NotedPageEditor)
- Used for: creating from scratch, customizing system templates, editing user templates, saving a page as template

### Integration Points

- **NotedPageList** - "New Page" button opens template gallery
- **NotedPageEditor** - "Save as Template" button saves current page content as a new template
- **noted-client.tsx** - Orchestrates gallery/editor dialogs and page creation flow

## User Flows

### Create page from template
1. Click "New Page" in page list
2. Browse/search templates in gallery
3. Click a card to preview content
4. Click "Use" to create a new page pre-filled with template content
5. Page is created in the active group and selected for editing

### Create page from blank
1. Click "New Page" in page list
2. Click "Blank Page" in gallery header
3. Empty page created and selected

### Save page as template
1. Open a page in the editor
2. Click "Save as Template" in the editor header
3. Template editor opens pre-filled with page title and content
4. Add description, pick category
5. Save creates a personal template

### Customize a system template
1. Open template gallery
2. Click "Customize" on a system template
3. Template editor opens with content cloned
4. Name is set to "Original Name (Custom)"
5. Save creates a new personal template (system template unchanged)

### Create template from scratch
1. Open template gallery
2. Click "Create Template"
3. Empty template editor opens
4. Fill in name, description, category, write content
5. Save creates a personal template

### Edit/delete a user template
1. Open template gallery, go to "My Templates" tab
2. Click "Edit" to modify or trash icon to delete
3. System templates cannot be edited or deleted

## Files

| File | Purpose |
|------|---------|
| `scripts/windows-server/51-create-noted-templates.sql` | Migration: table + system template seed data |
| `app/api/noted/templates/route.ts` | GET list + POST create |
| `app/api/noted/templates/[id]/route.ts` | GET/PUT/DELETE single template |
| `hooks/useNotedTemplates.ts` | Template state management hook |
| `components/noted/NotedTemplateGallery.tsx` | Gallery dialog with cards and preview |
| `components/noted/NotedTemplateEditor.tsx` | Create/edit template dialog |
| `app/api/noted/pages/route.ts` | Modified: POST now allows standalone pages (no stick required) |
| `components/noted/NotedPageList.tsx` | Modified: added "New Page" button |
| `components/noted/NotedPageEditor.tsx` | Modified: added "Save as Template" button |
| `app/noted/noted-client.tsx` | Modified: wires gallery/editor dialogs into layout |

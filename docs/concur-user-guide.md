# Concur Groups - User Guide

> **Goal:** Provide a Viva Engage-style community experience within Stick My Note. Concur Groups allow teams to have focused discussions using Sticks and threaded replies, managed by designated administrators.

---

## What Are Concur Groups?

Concur Groups are community spaces where team members can post Sticks (discussion topics) and have threaded conversations through replies. Think of them like Viva Engage communities — a place for team discussions, announcements, and collaboration.

Each group has **owners** who manage membership and **members** who participate by creating sticks and replies.

---

## Roles

| Role | Who Sets It | What They Can Do |
|------|-------------|-----------------|
| **Org Owner/Admin** | (inherits from org) | Add/remove Concur Administrators in Organization Settings; implicitly a Concur Administrator |
| **Concur Administrator** | Org Owner/Admin | Create new Concur groups via browser (/concur) or PowerShell script |
| **Group Owner** | Concur Administrator (2 required at creation) | Add/remove members, promote members to owner, pin/unpin sticks, delete any stick or reply, edit group name/description |
| **Group Member** | Group Owner (adds them) | Create sticks, reply to sticks (threaded), edit/delete own sticks and replies |

---

## Getting Started

### For Organization Owners/Admins

#### Step 1: Designate Concur Administrators

1. Navigate to **Organization Settings** (gear icon in the sidebar)
2. Click the **Concur** tab (visible only to org owners)
3. In the **Concur Administrators** section, enter the email address of the user you want to designate
4. Click **Add** — the user must already be a member of your organization
5. Repeat for additional administrators as needed

> **Note:** Concur Administrators are the only users who can create new groups. Choose trusted team leads or department heads.

#### Step 2: Share the PowerShell Script

The Concur tab displays a ready-to-use PowerShell script. Administrators can copy it and run it from their machine to create groups.

---

### For Concur Administrators

#### Creating a New Group (Browser)

1. Navigate to **/concur** — if you are a Concur Administrator or Organization Owner, you will see a **Create Group** button in the header
2. Click **Create Group** and fill in:
   - **Group Name** (required)
   - **Description** (optional)
   - **Owner 1 Email** (required)
   - **Owner 2 Email** (required)
3. Click **Create Group** to submit

#### Creating a New Group (PowerShell)

Use the PowerShell script from Organization Settings → Concur tab:

```powershell
.\Create-ConcurGroup.ps1 `
    -GroupName "Engineering Team" `
    -Description "Engineering discussions and updates" `
    -Owner1Email "alice@company.com" `
    -Owner2Email "bob@company.com" `
    -Email "admin@company.com" `
    -Password "yourpassword"
```

**Parameters:**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `-GroupName` | Yes | Name of the group |
| `-Description` | No | Brief description of the group's purpose |
| `-Owner1Email` | Yes | Email of the first group owner |
| `-Owner2Email` | Yes | Email of the second group owner |
| `-Email` | Yes | Your login email address |
| `-Password` | Yes | Your login password |
| `-OrgId` | No | Organization ID (only needed if you belong to multiple organizations) |

> **Note:** If your account uses two-factor authentication, create groups from the browser instead.

> **Important:** Every group must have exactly 2 owners at creation. Both owners must be existing members of the organization.

---

### For Group Owners

#### Managing Members

1. Navigate to **/concur** and click on your group
2. Click the **Members** button in the header (shows member count)
3. From the Members dialog you can:

**Add Individual Members:**
- Enter an email address and click the **+** button
- The user must be a member of your organization

**Bulk Import via CSV:**
- Click **Upload CSV** and select a `.csv` file
- CSV format: one email per line, or `email,name` per line
- Click **Import** to process the file
- Results show how many were added, skipped (already members), or not found

**Promote to Owner:**
- Click the crown icon next to a member's name to promote them to owner
- Owners can manage members and pin/unpin sticks

**Remove Members:**
- Click the trash icon next to a member's name to remove them from the group

#### Pinning Sticks

1. Click on a stick to open the detail view
2. Click the **pin icon** in the top-right corner
3. Pinned sticks appear in a dedicated section at the top of the group page
4. Click the pin icon again to unpin

---

### For Group Members

#### Navigating to Concur

There are two ways to reach Concur Groups:

1. **Via the Panel sidebar:** Navigate to **/panel** — use the collapsible left sidebar and click **Concur**
2. **Direct URL:** Go to **/concur** directly

The sidebar is collapsible — click the chevron to toggle between full labels and icon-only mode. Your preference is saved.

#### Browsing Groups

The **/concur** page shows all groups you belong to as cards displaying:
- Group name and description
- Member count and stick count
- Your role (owner/member)
- Latest activity timestamp

Click any card to enter the group.

#### Creating a Stick

1. Open a group by clicking its card
2. Click **Create Stick** (purple button in the header)
3. Fill in:
   - **Topic** (optional, max 75 characters) — a title for the discussion
   - **Content** (required, max 1000 characters) — the main message
   - **Color** — pick a sticky note color
4. Click **Create**

Your stick appears immediately in the group's grid.

#### Replying to a Stick

1. Click on any stick card to open the detail modal
2. The stick content is displayed at the top
3. Existing replies appear below in a threaded format
4. Type your reply in the text box at the bottom
5. Press **Ctrl+Enter** or click the send button to submit

**Threaded Replies:**
- Click **Reply** on any existing reply to create a nested response
- When replying to a reply, a "Replying to [name]" indicator shows above the input
- Click the **X** to cancel the nested reply and go back to a top-level reply
- Threads can nest up to 5 levels deep, color-coded by depth

#### Editing and Deleting

- You can delete your own replies by clicking the trash icon
- Group owners can delete any reply or stick

---

## Navigation Layout

The **/panel** page now includes a collapsible left sidebar:

```
+----------+--------------------------------------------------+
| Shared   |                                                  |
| Sticks   |        (Current page content)                    |
|          |                                                  |
| Concur   |                                                  |
|          |                                                  |
| [<<]     |                                                  |
+----------+--------------------------------------------------+
```

- **Shared Sticks** → `/panel` (existing community sticks search/discovery)
- **Concur** → `/concur` (Concur groups list)
- **[<<]** → Collapse toggle (saves preference to localStorage)

When collapsed, the sidebar shows only icons with tooltips on hover.

---

## Database Tables

Migration: `scripts/windows-server/54-create-concur-tables.sql`

| Table | Purpose |
|-------|---------|
| `concur_administrators` | Users authorized to create groups (per org) |
| `concur_groups` | Group containers with name, description, settings |
| `concur_group_members` | Membership with `owner` or `member` role |
| `concur_sticks` | Discussion posts within a group |
| `concur_stick_replies` | Threaded replies with `parent_reply_id` for nesting |

---

## API Reference

### Concur Administrators

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/api/concur/administrators` | Org owner/admin | List all Concur administrators |
| POST | `/api/concur/administrators` | Org owner/admin | Add administrator by email |
| DELETE | `/api/concur/administrators?userId=` | Org owner/admin | Remove administrator |

### Concur Groups

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/api/concur/groups` | Authenticated | List user's groups |
| POST | `/api/concur/groups` | Concur admin | Create group (name, 2 owner emails) |
| GET | `/api/concur/groups/[groupId]` | Group member | Get group details |
| PATCH | `/api/concur/groups/[groupId]` | Group owner | Update name/description |
| DELETE | `/api/concur/groups/[groupId]` | Group owner | Delete group |
| POST | `/api/concur/groups/create-via-script` | Concur admin | PowerShell script endpoint |

### Group Members

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/api/concur/groups/[groupId]/members` | Group member | List members |
| POST | `/api/concur/groups/[groupId]/members` | Group owner | Add member by email |
| POST | `/api/concur/groups/[groupId]/members/bulk` | Group owner | CSV bulk import |
| PATCH | `/api/concur/groups/[groupId]/members/[memberId]` | Group owner | Change role (promote to owner) |
| DELETE | `/api/concur/groups/[groupId]/members/[memberId]` | Group owner | Remove member |

### Concur Sticks

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/api/concur/groups/[groupId]/sticks` | Group member | List sticks (paginated) |
| POST | `/api/concur/groups/[groupId]/sticks` | Group member | Create stick |
| GET | `/api/concur/groups/[groupId]/sticks/[stickId]` | Group member | Get single stick |
| PATCH | `/api/concur/groups/[groupId]/sticks/[stickId]` | Author or owner | Edit stick / toggle pin |
| DELETE | `/api/concur/groups/[groupId]/sticks/[stickId]` | Author or owner | Delete stick |

### Concur Replies

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/api/concur/groups/[groupId]/sticks/[stickId]/replies` | Group member | List threaded replies |
| POST | `/api/concur/groups/[groupId]/sticks/[stickId]/replies` | Group member | Create reply (supports `parent_reply_id`) |
| PUT | `/api/concur/groups/[groupId]/sticks/[stickId]/replies` | Reply author | Edit reply |
| DELETE | `/api/concur/groups/[groupId]/sticks/[stickId]/replies?replyId=` | Author or owner | Delete reply |

---

## File Structure

```
app/
  concur/
    layout.tsx                    # Shared layout with PanelSidebar
    page.tsx                      # Groups list page
    [groupId]/
      page.tsx                    # Group detail with sticks grid
  panel/
    layout.tsx                    # Panel layout with PanelSidebar
  api/concur/
    administrators/route.ts       # Manage Concur admins
    groups/
      route.ts                    # List/create groups
      create-via-script/route.ts  # PowerShell endpoint
      [groupId]/
        route.ts                  # Get/update/delete group
        members/
          route.ts                # List/add members
          bulk/route.ts           # CSV import
          [memberId]/route.ts     # Update role/remove
        sticks/
          route.ts                # List/create sticks
          [stickId]/
            route.ts              # Get/edit/delete stick
            replies/route.ts      # Threaded replies CRUD
  settings/organization/
    _components/ConcurTab.tsx     # Org settings Concur tab

components/
  concur/
    concur-stick-detail-modal.tsx  # Stick + threaded replies view
    concur-members-dialog.tsx      # Member management dialog
    create-concur-stick-dialog.tsx  # Create stick form
  panel/
    panel-sidebar.tsx              # Collapsible sidebar (Shared Sticks / Concur)

scripts/windows-server/
  54-create-concur-tables.sql      # Database migration
```

---

## Future Enhancements (Category 4.2 - 4.10)

- **4.2 News & Announcements** — Organization-wide announcements with targeting and acknowledgment
- **4.3 Polls & Surveys** — Quick polls and multi-question surveys within groups
- **4.4 Recognition & Praise** — Kudos system with badges and leaderboards
- **4.5 Storytelling & Rich Posts** — Multi-media posts with cover images
- **4.6 Q&A / Ask Me Anything** — Structured Q&A with best answer marking
- **4.7 Events & Live Streams** — Event RSVP and live streaming integration
- **4.8 Sentiment Analysis** — Organization pulse surveys
- **4.9 Expertise Finder** — Skills profiles and expert search
- **4.10 Content Moderation** — AI moderation and reporting queue

-- Part 60: Library Tables
-- Description: File library system for Concur (personal/OneDrive-style), Alliance (pad-level),
--              and Inference (hub-level). Permissions inherit from parent resource roles.
-- Server: HOL-DC3-PGSQL (192.168.50.30), Database: stickmynote

-- =====================================================
-- LIBRARY FILES (Central file storage metadata)
-- =====================================================

CREATE TABLE IF NOT EXISTS library_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Scope: which hub and resource owns this file
    -- 'concur_user'   = personal library (OneDrive-style, owned by user)
    -- 'alliance_pad'  = pad-level library (owned by pad owners)
    -- 'inference_pad'  = inference pad-level library (owned by pad owners)
    scope_type TEXT NOT NULL CHECK (scope_type IN ('concur_user', 'alliance_pad', 'inference_pad')),
    scope_id UUID NOT NULL,  -- user_id for concur_user, pad_id for alliance_pad/inference_pad

    -- File metadata
    filename TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    file_path TEXT NOT NULL,          -- relative path under uploads/
    file_url TEXT NOT NULL,           -- URL path for serving (/uploads/...)
    mime_type TEXT NOT NULL,
    file_size BIGINT NOT NULL DEFAULT 0,

    -- Organization
    uploaded_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    description TEXT,
    folder TEXT,                       -- optional folder/category within the library

    -- Metadata
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_library_files_org ON library_files(org_id);
CREATE INDEX IF NOT EXISTS idx_library_files_scope ON library_files(scope_type, scope_id);
CREATE INDEX IF NOT EXISTS idx_library_files_uploaded_by ON library_files(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_library_files_folder ON library_files(scope_type, scope_id, folder);
CREATE INDEX IF NOT EXISTS idx_library_files_created ON library_files(scope_type, scope_id, created_at DESC);

-- =====================================================
-- LIBRARY FOLDERS (Optional folder organization)
-- =====================================================

CREATE TABLE IF NOT EXISTS library_folders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    scope_type TEXT NOT NULL CHECK (scope_type IN ('concur_user', 'alliance_pad', 'inference_pad')),
    scope_id UUID NOT NULL,
    name TEXT NOT NULL,
    parent_folder_id UUID REFERENCES library_folders(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(org_id, scope_type, scope_id, name, parent_folder_id)
);

CREATE INDEX IF NOT EXISTS idx_library_folders_scope ON library_folders(scope_type, scope_id);

-- Grant permissions to application user
GRANT SELECT, INSERT, UPDATE, DELETE ON library_files TO stickmynote_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON library_folders TO stickmynote_user;

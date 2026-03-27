-- Part 61: Alter Library Tables - Stick-Scoped Folders
-- Description: Redesign library to be one unified library where each Stick
--              gets its own folder. Permissions inherit from stick ownership.
-- Server: HOL-DC3-PGSQL (192.168.50.30), Database: stickmynote

-- Clear any rows with old scope types (library was just created, no real data)
DELETE FROM library_files WHERE scope_type != 'stick';
DELETE FROM library_folders WHERE scope_type != 'stick';

-- Drop the old scope_type constraint and replace with 'stick'
ALTER TABLE library_files DROP CONSTRAINT IF EXISTS library_files_scope_type_check;
ALTER TABLE library_files ADD CONSTRAINT library_files_scope_type_check
    CHECK (scope_type IN ('stick'));

-- Add stick_type column to identify which kind of stick owns the folder
ALTER TABLE library_files ADD COLUMN IF NOT EXISTS stick_type TEXT;
-- stick_type: 'personal', 'concur', 'alliance', 'inference'

-- Update folder constraint on library_folders too
ALTER TABLE library_folders DROP CONSTRAINT IF EXISTS library_folders_scope_type_check;
ALTER TABLE library_folders ADD CONSTRAINT library_folders_scope_type_check
    CHECK (scope_type IN ('stick'));

ALTER TABLE library_folders ADD COLUMN IF NOT EXISTS stick_type TEXT;

-- Recreate indexes (drop old ones, create new)
DROP INDEX IF EXISTS idx_library_files_scope;
CREATE INDEX IF NOT EXISTS idx_library_files_stick ON library_files(scope_id) WHERE scope_type = 'stick';

DROP INDEX IF EXISTS idx_library_folders_scope;
CREATE INDEX IF NOT EXISTS idx_library_folders_stick ON library_folders(scope_id) WHERE scope_type = 'stick';

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON library_files TO stickmynote_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON library_folders TO stickmynote_user;
